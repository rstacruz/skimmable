#!/usr/bin/env node
// skimmable — Claude Code SessionStart hook
//
// Emits the skimmable ruleset as hidden stdout, which Claude Code injects
// into the system context — always-on before the first prompt.
//
// SessionStart re-fires mid-session (resume, /clear, context compaction).
// A true `startup` resets to the default (skimmable ON); a re-fire preserves
// the user's choice — if they said "stop skimmable" this session, the
// ruleset is not re-injected (caveman #691 pattern).
//
// Silent-fails on everything — never block session start.

const fs = require('fs');
const { isOn, safeWriteFlag, readSkill, FALLBACK_RULES } = require('./skimmable-config');

// Read the hook payload from stdin. TTY (manual run) → treat as startup.
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
  // Fresh session: skimmable on by default. Writing the flag here is what
  // makes the tracker reinforce every turn — without it, reinforcement
  // would never fire until the user explicitly activates.
  safeWriteFlag('1');
} else if (!isOn()) {
  // Mid-session re-fire and the user turned skimmable off — stay off.
  process.stdout.write('OK');
  process.exit(0);
}

const body = readSkill() || FALLBACK_RULES;
process.stdout.write('SKIMMABLE MODE ACTIVE\n\n' + body);
