/**
 * skimmable — pi extension
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

const STOP_RE = /\b(stop skimmable|disable skimmable|deactivate skimmable|skimmable off|normal mode)\b/i;
const START_RE = /\b(skimmable( mode)?|reply skimmable|use skimmable|activate skimmable|write skimmable)\b/i;

const FALLBACK_RULES =
  "Format every reply for skimmability: short sentences, " +
  'lists over paragraphs, code blocks for illustration. Off only: "stop skimmable" / "normal mode".';

function readSkill(): string {
  const candidates = [
    resolve(__dirname, "..", "skills", "skimmable", "SKILL.md"),
    join(homedir(), ".pi", "agent", "skills", "skimmable", "SKILL.md"),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8").replace(/^---[\s\S]*?---\s*/, "");
    } catch { /* try next */ }
  }
  return "";
}

export default function skimmable(pi: ExtensionAPI) {
  let on = true; // fresh pi process = fresh session = skimmable ON

  pi.on("before_agent_start", async (event) => {
    const prompt = event.prompt.trim().toLowerCase().replace(/\s+/g, " ");

    const rules = readSkill() || FALLBACK_RULES;

    if (STOP_RE.test(prompt)) {
      on = false;
      return {
        message: {
          customType: "skimmable",
          content: "SKIMMABLE OFF — reply in normal format from now on.",
          display: true,
        },
      };
    }

    if (START_RE.test(prompt)) {
      on = true;
      return;
    }

    if (!on) return;

    // Per-turn reinforcement, so the style survives compaction — same
    // mechanism as the Claude plugin's UserPromptSubmit additionalContext.
    return { systemPrompt: event.systemPrompt + "\n\nSKIMMABLE MODE ACTIVE\n\n" + rules };
  });
}
