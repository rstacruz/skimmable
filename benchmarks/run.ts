#!/usr/bin/env bun
/** Benchmark skimmable vs normal Claude output token counts.
 *
 *  Port of benchmarks/run.py to Bun + TypeScript; worker concurrency via
 *  p-queue. Same CLI flags, same results/*.json schema, so consumers
 *  (README table, results JSON) are unchanged.
 *
 *  Runs `claude -p --bare` (no API key needed). --bare skips hooks and plugin
 *  sync, so the globally-installed skimmable plugin can't contaminate the
 *  "normal" baseline; the ruleset is injected explicitly with
 *  --append-system-prompt, mirroring how the plugin's SessionStart hook ships it.
 */

import { parseArgs } from "node:util";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import PQueue from "p-queue";

const SCRIPT_VERSION = "1.3.0";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DIR = join(HERE, "..");
const PROMPTS_PATH = join(HERE, "prompts.json");
const SKILL_PATH = join(REPO_DIR, "skills", "skimmable", "SKILL.md");
const README_PATH = join(REPO_DIR, "README.md");
const RESULTS_DIR = join(HERE, "results");
const BENCHMARK_START = "<!-- BENCHMARK-TABLE-START -->";
const BENCHMARK_END = "<!-- BENCHMARK-TABLE-END -->";
const CALL_TIMEOUT_MS = 300_000;

type Prompt = { id: string; category: string; prompt: string };
type CallResult = { input_tokens: number; output_tokens: number; text: string; stop_reason?: string };
type ClaudeResponse = { is_error?: boolean; usage: { input_tokens: number; output_tokens: number }; result?: string; stop_reason?: string };
type Entry = Prompt & { normal: CallResult[]; skimmable: CallResult[] };
type Row = { id: string; category: string; prompt: string; normal_median: number; skimmable_median: number; savings_pct: number };
type Summary = { avg_savings: number; min_savings: number; max_savings: number; avg_normal: number; avg_skimmable: number };

const loadPrompts = (): Prompt[] => JSON.parse(readFileSync(PROMPTS_PATH, "utf8")).prompts;

const loadSkimmableSystem = (): string => {
  // Match src/hooks/skimmable-config.js: YAML frontmatter is stripped before
  // the ruleset is injected, so benchmark what actually ships.
  let content = readFileSync(SKILL_PATH, "utf8");
  if (content.startsWith("---")) {
    const parts = content.split("---");
    if (parts.length >= 3) content = parts.slice(2).join("---");
  }
  return content;
};

const sha256File = async (p: string) =>
  new Bun.CryptoHasher("sha256").update(await Bun.file(p).arrayBuffer()).digest("hex");

const claudeVersion = async (): Promise<string> => {
  try {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
      signal: AbortSignal.timeout(15_000),
    });
    await proc.exited;
    return (await new Response(proc.stdout).text()).trim() || "unknown";
  } catch {
    return "unknown";
  }
};

/** One `claude -p --bare --output-format json` call, with retry. */
async function callClaude(prompt: string, systemPrompt: string | null, model: string | null, cwd: string): Promise<CallResult> {
  const cmd = ["claude", "-p", "--bare", "--output-format", "json"];
  if (model) cmd.push("--model", model);
  if (systemPrompt) cmd.push("--append-system-prompt", systemPrompt);
  cmd.push(prompt);
  // --tools "" must come AFTER the prompt (variadic; it would swallow the
  // prompt otherwise). Implementation prompts ("implement X") make the model
  // attempt Write, and the tool loop stalls on non-TTY stdin. Pure-text
  // generation also keeps token counts comparable across modes.
  cmd.push("--tools", "");

  const delays = [5_000, 10_000, 20_000];
  for (let attempt = 0; ; attempt++) {
    try {
      const proc = Bun.spawn(cmd, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS), // kills child on timeout
      });
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exit = await proc.exited;
      const data = JSON.parse(stdout) as ClaudeResponse;
      if (exit !== 0 || data.is_error) throw new Error(`exit=${exit} stderr=${stderr.slice(-300)}`);
      return {
        input_tokens: data.usage.input_tokens,
        output_tokens: data.usage.output_tokens,
        text: data.result ?? "",
        stop_reason: data.stop_reason,
      };
    } catch (e) {
      if (attempt >= 3) throw e;
      const delay = delays[Math.min(attempt, delays.length - 1)];
      console.error(`  Call failed (${e}), retrying in ${delay / 1000}s...`);
      await Bun.sleep(delay);
    }
  }
}

type Unit = { pid: string; prompt: string; mode: "normal" | "skimmable"; system: string | null; trial: number };
type ModeResult = Unit & { result: CallResult };

async function runBenchmarks(prompts: Prompt[], systemPrompt: string, trials: number, model: string | null, workers: number): Promise<Entry[]> {
  // Normal/skimmable trials are interleaved per prompt so both modes see the
  // same rate-limit drift. Trials complete out of order; results are
  // re-sorted by trial index before returning.
  const units: Unit[] = [];
  for (const p of prompts)
    for (let t = 1; t <= trials; t++)
      for (const [mode, system] of [["normal", null], ["skimmable", systemPrompt]] as const)
        units.push({ pid: p.id, prompt: p.prompt, mode, system, trial: t });

  const total = units.length;
  let done = 0;

  const queue = new PQueue({ concurrency: workers });
  const out = await queue.addAll(
    units.map((u) => async (): Promise<ModeResult> => {
      console.error(`  [${++done}/${total}] ${u.pid} | ${u.mode} | trial ${u.trial}/${trials}`);
      // Scratch subdir per trial so concurrent model writes can't collide.
      const cwd = mkdtempSync(join(tmpdir(), "trial-"));
      try {
        return { ...u, result: await callClaude(u.prompt, u.system, model, cwd) };
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    }),
  );

  return prompts.map((p) => ({
    ...p,
    normal: out.filter((r) => r.pid === p.id && r.mode === "normal").sort((a, b) => a.trial - b.trial).map((r) => r.result),
    skimmable: out.filter((r) => r.pid === p.id && r.mode === "skimmable").sort((a, b) => a.trial - b.trial).map((r) => r.result),
  }));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function computeStats(results: Entry[]): { rows: Row[]; summary: Summary } {
  const rows: Row[] = [];
  const savings: number[] = [];
  for (const e of results) {
    const n = median(e.normal.map((t) => t.output_tokens));
    const s = median(e.skimmable.map((t) => t.output_tokens));
    const sv = n > 0 ? 1 - s / n : 0;
    savings.push(sv);
    rows.push({
      id: e.id,
      category: e.category,
      prompt: e.prompt,
      normal_median: Math.round(n),
      skimmable_median: Math.round(s),
      savings_pct: Math.round(sv * 100),
    });
  }
  const avg = (f: (r: Row) => number) => Math.round(rows.reduce((a, r) => a + f(r), 0) / rows.length);
  return {
    rows,
    summary: {
      avg_savings: Math.round((savings.reduce((a, b) => a + b, 0) / savings.length) * 100),
      min_savings: Math.round(Math.min(...savings) * 100),
      max_savings: Math.round(Math.max(...savings) * 100),
      avg_normal: avg((r) => r.normal_median),
      avg_skimmable: avg((r) => r.skimmable_median),
    },
  };
}

const LABELS: Record<string, string> = {
  "react-rerender": "Explain React re-render bug",
  "auth-middleware-fix": "Fix auth middleware token expiry",
  "postgres-pool": "Set up PostgreSQL connection pool",
  "git-rebase-merge": "Explain git rebase vs merge",
  "async-refactor": "Refactor callback to async/await",
  "microservices-monolith": "Architecture: microservices vs monolith",
  "pr-security-review": "Review PR for security issues",
  "docker-multi-stage": "Docker multi-stage build",
  "race-condition-debug": "Debug PostgreSQL race condition",
  "error-boundary": "Implement React error boundary",
};

function formatTable(rows: Row[], summary: Summary): string {
  const lines = [
    "| Task | Normal (tokens) | Skimmable (tokens) | Saved |",
    "|------|---------------:|-------------------:|------:|",
  ];
  for (const r of rows) lines.push(`| ${LABELS[r.id] ?? r.id} | ${r.normal_median} | ${r.skimmable_median} | ${r.savings_pct}% |`);
  lines.push(
    `| **Average** | **${summary.avg_normal}** | **${summary.avg_skimmable}** | **${summary.avg_savings}%** |`,
    "",
    `*Range: ${summary.min_savings}%–${summary.max_savings}% savings across prompts.*`,
  );
  return lines.join("\n");
}

function saveResults(results: Entry[], rows: Row[], summary: Summary, model: string | null, trials: number, skillHash: string, version: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const path = join(RESULTS_DIR, `benchmark_${ts}.json`);
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      {
        metadata: {
          script_version: SCRIPT_VERSION,
          claude_version: version,
          model: model ?? "default",
          date: now.toISOString(),
          trials,
          skill_md_sha256: skillHash,
        },
        summary,
        rows,
        raw: results,
      },
      null,
      2,
    ),
  );
  return path;
}

function updateReadme(tableMd: string): void {
  const content = readFileSync(README_PATH, "utf8");
  const start = content.indexOf(BENCHMARK_START);
  const end = content.indexOf(BENCHMARK_END);
  if (start === -1 || end === -1) {
    console.error("ERROR: Benchmark markers not found in README.md");
    process.exit(1);
  }
  writeFileSync(README_PATH, `${content.slice(0, start + BENCHMARK_START.length)}\n${tableMd}\n${content.slice(end)}`);
  console.error("README.md updated.");
}

function dryRun(prompts: Prompt[], model: string | null, trials: number, workers: number): void {
  console.log(`Model:  ${model ?? "default"}`);
  console.log(`Trials: ${trials}`);
  console.log(`Prompts: ${prompts.length}`);
  console.log(`Workers: ${workers}`);
  console.log(`Total API calls: ${prompts.length * 2 * trials}`);
  console.log(`Runs: claude -p --bare${model ? ` --model ${model}` : ""}`);
  console.log();
  for (const p of prompts) {
    const preview = p.prompt.length > 80 ? `${p.prompt.slice(0, 80)}...` : p.prompt;
    console.log(`  [${p.id}] (${p.category})`);
    console.log(`    ${preview}`);
  }
  console.log("\nDry run complete. No API calls made.");
}

async function main() {
  const { values } = parseArgs({
    options: {
      trials: { type: "string", default: "3" },
      "dry-run": { type: "boolean", default: false },
      "update-readme": { type: "boolean", default: false },
      model: { type: "string" },
      workers: { type: "string", default: "5" },
    },
  });
  const trials = Number(values.trials);
  const workers = Number(values.workers);
  const model = values.model ?? null;

  const prompts = loadPrompts();
  if (values["dry-run"]) {
    dryRun(prompts, model, trials, workers);
    return;
  }

  const systemPrompt = loadSkimmableSystem();
  const [skillHash, version] = await Promise.all([sha256File(SKILL_PATH), claudeVersion()]);

  console.error(`Running benchmarks: ${prompts.length} prompts x 2 modes x ${trials} trials (${workers} concurrent)`);
  console.error(`Model: ${model ?? "default"} | claude ${version}`);
  console.error();

  const results = await runBenchmarks(prompts, systemPrompt, trials, model, workers);
  const { rows, summary } = computeStats(results);
  const tableMd = formatTable(rows, summary);
  const jsonPath = saveResults(results, rows, summary, model, trials, skillHash, version);

  console.error(`\nResults saved to ${jsonPath}`);
  if (values["update-readme"]) updateReadme(tableMd);
  console.log(tableMd);
}

await main();
