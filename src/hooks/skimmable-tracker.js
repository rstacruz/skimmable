#!/usr/bin/env node
// skimmable — Claude Code UserPromptSubmit hook
//
// 1. Per-turn reinforcement: when skimmable is on, emit a short
//    additionalContext reminder so the style survives context compaction
//    and competing plugin injections (caveman's pattern).
// 2. Natural-language toggle:
//      "stop skimmable" / "normal mode" / "disable skimmable" → off
//      "skimmable" / "skimmable mode" / "reply skimmable" → on
//    Both announce themselves via additionalContext; activation emits the
//    full ruleset so it works mid-session without a session restart.
//
// Skips scheduled-task prompts entirely — unattended runs must never get
// skimmable styling (caveman's rule, same reasoning).

const fs = require('fs');
const { isOn, safeWriteFlag, clearFlag, readSkill, FALLBACK_RULES } = require('./skimmable-config');

const STOP_RE = /\b(stop skimmable|disable skimmable|deactivate skimmable|skimmable off|normal mode)\b/i;
const START_RE = /\b(skimmable( mode)?|reply skimmable|use skimmable|activate skimmable|write skimmable)\b/i;

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
// Abnormal stdin close (broken pipe, parent crash): exit 0 — hooks must
// never surface as failures (#538).
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Collapse whitespace so phrase triggers match multiline prompts.
    const prompt = (data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');

    // Unattended scheduled tasks never get skimmable styling.
    if (/<scheduled-task\b/.test(prompt)) return;

    const out = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };

    if (STOP_RE.test(prompt)) {
      clearFlag();
      out.hookSpecificOutput.additionalContext =
        'SKIMMABLE OFF — reply in normal format from now on.';
    } else if (START_RE.test(prompt)) {
      safeWriteFlag('1');
      out.hookSpecificOutput.additionalContext =
        'SKIMMABLE MODE ACTIVE\n\n' + (readSkill() || FALLBACK_RULES);
    } else if (isOn()) {
      out.hookSpecificOutput.additionalContext =
        'SKIMMABLE ACTIVE — format replies for skimmability. ' +
        'Short sentences. Lists over paragraphs. Code blocks for illustration. ' +
        'Code, identifiers, paths, commands, URLs, error strings: verbatim.';
    } else {
      return; // off, no trigger — emit nothing
    }

    process.stdout.write(JSON.stringify(out));
  } catch (e) {
    // Silent fail
  }
});
