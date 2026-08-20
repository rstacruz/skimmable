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

// Per-turn reminder when already on
const REMINDER =
  "SKIMMABLE ACTIVE — format replies for skimmability. " +
  "Short sentences. Lists over paragraphs. Code blocks for illustration. " +
  "Code, identifiers, paths, commands, URLs, error strings: verbatim.";

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
  let needsRules = false; // set on compaction; consumed at next prompt

  // After compaction the system prompt is gone — re-inject the full
  // ruleset at the next user prompt (same mechanism as the Claude
  // plugin's SessionStart refresh on source='compact').
  pi.on("session_compact", () => {
    needsRules = true;
  });

  pi.on("before_agent_start", async (event) => {
    const prompt = event.prompt.trim().toLowerCase().replace(/\s+/g, " ");

    const rules = readSkill() || FALLBACK_RULES;

    // Full-ruleset injection — shared by activation and the compaction
    // refresh so the two can never diverge.
    const withRules = (systemPrompt: string) =>
      systemPrompt + "\n\nSKIMMABLE MODE ACTIVE\n\n" + rules;

    if (STOP_RE.test(prompt)) {
      on = false;
      needsRules = false;
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
      needsRules = false; // ruleset emitted below; don't double-inject
      // Emit the full ruleset on the activation turn itself.
      return { systemPrompt: withRules(event.systemPrompt) };
    }

    if (!on) return;

    // Compaction wiped the ruleset — refresh it once, then back to reminders.
    if (needsRules) {
      needsRules = false;
      return { systemPrompt: withRules(event.systemPrompt) };
    }

    // Per-turn reinforcement, so the style survives compaction — same
    // mechanism as the Claude plugin's UserPromptSubmit additionalContext.
    return { systemPrompt: event.systemPrompt + "\n\n" + REMINDER };
  });
}
