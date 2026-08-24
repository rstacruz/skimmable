/**
 * skimmable — pi extension
 *
 * Emulates oh-my-pi's PERSONALITY.md mechanism for pi: the skimmable
 * ruleset is appended to the system prompt on every turn. Always on —
 * no toggle, no reminders, no compaction handling.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractRuleset } from "../src/utils/skill";

const FALLBACK_RULES =
  "Format every reply for skimmability: short sentences, " +
  "lists over paragraphs, code blocks for illustration.";

// Canonical source: PERSONALITY.md is the single source of truth
// (AGENTS.md); the skill and output-style copies are generated from it.
function readRules(): string {
  try {
    const rules = extractRuleset(
      readFileSync(resolve(__dirname, "..", "PERSONALITY.md"), "utf8"),
    );
    if (rules) return rules;
  } catch {
    // missing/unreadable -> fallback below
  }
  return FALLBACK_RULES;
}

export default function skimmable(pi: ExtensionAPI) {
  // Loaded once per session, mirroring oh-my-pi: the personality block is
  // fixed when the session starts, keeping the system prompt cache-stable.
  const rules = readRules();

  // Every turn, same suffix => byte-identical system prompt => warm provider
  // prompt cache. Compaction replaces messages only, so nothing to refresh.
  pi.on("before_agent_start", async (event) => ({
    systemPrompt: event.systemPrompt + "\n\n" + rules,
  }));
}
