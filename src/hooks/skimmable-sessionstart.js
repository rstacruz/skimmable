#!/usr/bin/env node
// skimmable — Claude Code SessionStart hook
// Emits the ruleset as hidden stdout injected into system context.
// Startup → skimmable ON; mid-session re-fire preserves the user's choice.
// Silent-fails — never block session start.

const fs = require('fs');
const { isOn, safeWriteFlag, readSkill, FALLBACK_RULES } = require('./skimmable-config');

// Read hook payload from stdin; TTY (manual run) → startup.
let source = 'startup';
try {
  if (!process.stdin.isTTY) {
    const raw = fs.readFileSync(0, 'utf8');
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.source === 'string') source = data.source;
    }
  }
} catch (e) { /* no/bad stdin → treat as startup */ }

if (source === 'startup') {
  // Fresh session: default ON — flag needed for per-turn reinforcement.
  safeWriteFlag('1');
} else if (!isOn()) {
  // Mid-session re-fire with skimmable off — stay off.
  process.stdout.write('OK');
  process.exit(0);
}

const body = readSkill() || FALLBACK_RULES;
process.stdout.write('SKIMMABLE MODE ACTIVE\n\n' + body);
