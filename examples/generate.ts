#!/usr/bin/env bun
/** Generate skimmable example outputs: for every prompt in benchmarks/prompts.json,
 *  run `claude -p` with skills/skimmable/SKILL.md (frontmatter stripped) as the
 *  system prompt, save the reply as examples/<id>.md.
 *
 *  Usage:
 *    bun examples/generate.ts                  # skip ids that already have a file
 *    bun examples/generate.ts --limit 3        # only the first 3 prompts
 *    bun examples/generate.ts --force          # regenerate everything
 *    bun examples/generate.ts --dry-run        # print what would run, no API calls
 *    MODEL=opus bun examples/generate.ts       # pick a model
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PromiseQueue } from "../src/utils/pqueue";
import { callClaude } from "../src/utils/claude";

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
  },
});
const force = values.force;
const dryRun = values["dry-run"];
const model = process.env.MODEL;
const limit = values.limit === undefined ? Infinity : Number(values.limit);
if (values.limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
  console.error("error: --limit expects a positive number");
  process.exit(1);
}

// Strip YAML frontmatter (--- ... ---) from the skill so only the body is injected.
const skill = readFileSync(SKILL_PATH, "utf8").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
const { prompts }: { prompts: Prompt[] } = JSON.parse(readFileSync(PROMPTS_PATH, "utf8"));
const selected = prompts.slice(0, limit);

const todo = selected.filter((p) => {
  const out = join(HERE, `${p.id}.md`);
  if (!force && existsSync(out)) {
    console.log(`skip: ${out} exists (use --force)`);
    return false;
  }
  return true;
});

if (dryRun) {
  for (const p of todo) console.log(`would run: ${join(HERE, `${p.id}.md`)}`);
  process.exit(0);
}

const queue = new PromiseQueue(CONCURRENCY);
await Promise.all(
  todo.map((p) =>
    queue.add(async () => {
      console.log(`generating: ${p.id} ...`);
      try {
        const output = await callClaude(p.prompt, { model, systemPrompt: skill });
        writeFileSync(join(HERE, `${p.id}.md`), output.text.trim() + "\n");
        console.log(`saved: ${p.id}.md`);
      } catch (e) {
        console.error(`error: failed to generate ${p.id}, skipping (${e})`);
      }
    }),
  ),
);
