#!/usr/bin/env node
// skimmable — Claude Code UserPromptSubmit hook
// 1. Per-turn reinforcement reminder when on (survives compaction).
// 2. Natural-language toggle: "stop skimmable"/"normal mode" → off;
//    "skimmable mode" → on, emitting the full ruleset mid-session.
// Skips scheduled-task prompts.

const { isOn, safeWriteFlag, clearFlag, readSkill, FALLBACK_RULES, bumpTurnCount, resetTurnCount } = require('./skimmable-config');

// Turns 1-2 get the short reminder: session start already injects the
// ruleset. Mirrored in extensions/skimmable.ts; change both in lockstep
const FULL_EVERY = 3;

// Activation and cadence refresh must not diverge
function fullRules() {
  return 'SKIMMABLE MODE ACTIVE\n\n' + (readSkill() || FALLBACK_RULES);
}

const STOP_RE = /\b(stop skimmable|disable skimmable|deactivate skimmable|skimmable off|normal mode)\b/i;
const START_RE = /\b(skimmable( mode)?|reply skimmable|use skimmable|activate skimmable|write skimmable)\b/i;

let input = '';
process.stdin.on('data', chunk => { input += chunk; });
// Abnormal stdin close → exit 0; hooks must never surface as failures.
process.stdin.on('error', () => process.exit(0));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;
    // Collapse whitespace so phrase triggers match multiline prompts.
    const prompt = (data.prompt || '').trim().toLowerCase().replace(/\s+/g, ' ');

    // Unattended scheduled tasks never get skimmable styling.
    if (/<scheduled-task\b/.test(prompt)) return;

    const out = { hookSpecificOutput: { hookEventName: 'UserPromptSubmit' } };

    if (STOP_RE.test(prompt)) {
      clearFlag();
      resetTurnCount(sessionId);
      out.hookSpecificOutput.additionalContext =
        'SKIMMABLE OFF — reply in normal format from now on.';
    } else if (START_RE.test(prompt)) {
      const wasOn = isOn();
      safeWriteFlag('1');
      // A real off-to-on activation restarts the cadence; an already-on session
      // merely re-emphasizing (or asking about the feature) must not shift it
      if (!wasOn) resetTurnCount(sessionId);
      out.hookSpecificOutput.additionalContext = fullRules();
    } else if (isOn()) {
      const turn = bumpTurnCount(sessionId);
      if (turn % FULL_EVERY === 0) {
        out.hookSpecificOutput.additionalContext = fullRules();
      } else {
        out.hookSpecificOutput.additionalContext =
          'SKIMMABLE ACTIVE — format replies for skimmability. ' +
          'Short sentences. Lists over paragraphs. Code blocks for illustration. ' +
          'Code, identifiers, paths, commands, URLs, error strings: verbatim.';
      }
    } else {
      return; // off, no trigger — emit nothing
    }

    process.stdout.write(JSON.stringify(out));
  } catch (e) {
    // Silent fail
  }
});
