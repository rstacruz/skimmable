import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync } from "fs";
import { resolve } from "path";
import { extractRuleset } from "../src/utils/skill";

const FALLBACK_RULES =
  "Format every reply for skimmability: short sentences, " +
  "lists over paragraphs, code blocks for illustration.";

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
  const rules = readRules();

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: event.systemPrompt + "\n\n" + rules,
  }));
}
