#!/usr/bin/env bun
/** Generate skimmable example outputs: for every prompt in benchmarks/prompts.json,
 *  run `claude -p` with skills/skimmable/SKILL.md (frontmatter stripped) as the
 *  system prompt, save the reply as examples/<id>.md.
 *
 *  Usage:
 *    bun examples/generate.ts                    # skip ids that already have a file
 *    bun examples/generate.ts --mode default     # bare claude, no skill injected
 *    bun examples/generate.ts --limit 3          # only the first 3 prompts
 *    bun examples/generate.ts --force            # regenerate everything
 *    bun examples/generate.ts --dry-run          # print what would run, no API calls
 *    bun examples/generate.ts --out-dir /tmp/examples  # save elsewhere (default: examples/)
 *    MODEL=opus bun examples/generate.ts         # pick a model
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PromiseQueue } from "../src/utils/pqueue";
import { callClaude } from "../src/utils/claude";
import { stripSkillMarkers } from "../src/utils/skill";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PROMPTS_PATH = join(REPO, "benchmarks", "prompts.json");
const SKILL_PATH = join(REPO, "skills", "skimmable", "SKILL.md");
const CONCURRENCY = 5;

type Prompt = { id: string; category: string; prompt: string };

const { values } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    limit: { type: "string" },
    mode: { type: "string", default: "skimmable" },
    "out-dir": { type: "string" },
  },
});
const force = values.force;
const dryRun = values["dry-run"];
const model = process.env.MODEL;
const mode = values.mode ?? "skimmable";
if (mode !== "default" && mode !== "skimmable") {
  console.error('error: --mode expects "default" or "skimmable"');
  process.exit(1);
}
const limit = values.limit === undefined ? Infinity : Number(values.limit);
if (values.limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
  console.error("error: --limit expects a positive number");
  process.exit(1);
}

const OUT_DIR = values["out-dir"] ? resolve(values["out-dir"]) : HERE;
mkdirSync(OUT_DIR, { recursive: true });

const bare = mode === "default";
const systemPrompt = bare
  ? undefined
  : stripSkillMarkers(readFileSync(SKILL_PATH, "utf8"));
const { prompts }: { prompts: Prompt[] } = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));
const selected = prompts.slice(0, limit);
const outFile = (id: string) => join(OUT_DIR, `${id}.${mode}.md`);

const todo = selected.filter((p) => {
  const out = outFile(p.id);
  if (!force && existsSync(out)) {
    console.log(`skip: ${out} exists (use --force)`);
    return false;
  }
  return true;
});

if (dryRun) {
  for (const p of todo) console.log(`would run: ${outFile(p.id)}`);
  process.exit(0);
}

const queue = new PromiseQueue(CONCURRENCY);
await Promise.all(
  todo.map((p) =>
    queue.add(async () => {
      console.log(`generating: ${p.id} ...`);
      try {
        const output = await callClaude(p.prompt, { model, bare, systemPrompt });
        const question = p.prompt
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        writeFileSync(outFile(p.id), `${question}\n\n---\n\n${output.text.trim()}\n`);
        console.log(`saved: ${outFile(p.id)}`);
      } catch (e) {
        console.error(`error: failed to generate ${p.id}, skipping (${e})`);
      }
    }),
  ),
);
