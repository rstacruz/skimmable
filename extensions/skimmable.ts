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

// Every 3rd ON turn re-embeds the rules (drift refresh). The counter is
// in-memory: the event carries no session id, so a restart resets it
// Mirrored in src/hooks/skimmable-userpromptsubmit.js; change both in lockstep
const FULL_EVERY = 3;

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
  let turn = 0;
  let needsRules = false; // set on compaction; consumed at next prompt

  // Compaction clears the system prompt, so re-inject the rules
  pi.on("session_compact", () => {
    needsRules = true;
  });

  pi.on("before_agent_start", async (event) => {
    const prompt = event.prompt.trim().toLowerCase().replace(/\s+/g, " ");

    const rules = readSkill() || FALLBACK_RULES;

    // Shared injection path so activation and compaction refresh can't diverge
    const withRules = (systemPrompt: string) =>
      systemPrompt + "\n\nSKIMMABLE MODE ACTIVE\n\n" + rules;

    if (STOP_RE.test(prompt)) {
      on = false;
      turn = 0;
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
      const wasOn = on;
      on = true;
      // Only a real off-to-on activation restarts the cadence; re-emphasizing
      // on an already-on session (or asking about the feature) must not shift it
      if (!wasOn) turn = 0;
      needsRules = false; // ruleset emitted below; don't double-inject
      // Emit the full ruleset on the activation turn itself.
      return { systemPrompt: withRules(event.systemPrompt) };
    }

    if (!on) return;

    // Restart the cadence after the compaction refresh so it isn't followed
    // by a turn % 3 embed
    if (needsRules) {
      needsRules = false;
      turn = 0;
      return { systemPrompt: withRules(event.systemPrompt) };
    }

    turn += 1;
    if (turn % FULL_EVERY === 0) {
      return { systemPrompt: withRules(event.systemPrompt) };
    }

    // Per-turn reinforcement, so the style survives compaction — same
    // mechanism as the Claude plugin's UserPromptSubmit additionalContext.
    return { systemPrompt: event.systemPrompt + "\n\n" + REMINDER };
  });
}
