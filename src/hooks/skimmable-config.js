#!/usr/bin/env node
// skimmable — shared helpers for the skimmable hooks
//
// State: one flag file at $CLAUDE_CONFIG_DIR/.skimmable-active.
//   exists → ON (default: written at session start); absent → OFF.
// Plus one state file at $CLAUDE_CONFIG_DIR/.skimmable-state — a JSON map
//   { sessionId: { turnCount: n } } backing the every-3rd-turn full-ruleset
//   cadence (see skimmable-userpromptsubmit.js).
// Every helper silent-fails — hooks must never block session start or
// prompt submission.

const fs = require('fs');
const path = require('path');
const os = require('os');

const FLAG_NAME = '.skimmable-active';
const MAX_FLAG_BYTES = 64;
const STATE_NAME = '.skimmable-state';
const MAX_STATE_BYTES = 256 * 1024;

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function flagPath() {
  return path.join(claudeDir(), FLAG_NAME);
}

function statePath() {
  return path.join(claudeDir(), STATE_NAME);
}

// Symlink-safe atomic write: refuse a symlinked target (clobber vector);
// resolve a symlinked parent dir and verify ownership — legit ~/.claude
// works, attacker-planted refused. O_NOFOLLOW, temp+rename, 0600.
// Silent-fails. Shared by the flag file and the state file.
function atomicWrite(dir, name, content) {
  try {
    fs.mkdirSync(dir, { recursive: true });

    let realDir;
    try {
      const lstat = fs.lstatSync(dir);
      if (lstat.isSymbolicLink()) {
        realDir = fs.realpathSync(dir);
        const st = fs.statSync(realDir);
        if (!st.isDirectory()) return;
        if (typeof process.getuid === 'function' && st.uid !== process.getuid()) return;
      } else {
        realDir = dir;
      }
    } catch (e) {
      return;
    }

    const realTarget = path.join(realDir, name);
    try {
      if (fs.lstatSync(realTarget).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    const temp = path.join(realDir, `${name}.${process.pid}.${Date.now()}`);
    let fd;
    try {
      fd = fs.openSync(temp, flags, 0o600);
      fs.writeSync(fd, String(content));
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    try {
      fs.renameSync(temp, realTarget);
    } finally {
      try { fs.unlinkSync(temp); } catch (e) { /* already renamed */ }
    }
    return true;
  } catch (e) {
    // Silent fail — file is best-effort
    return false;
  }
}

function safeWriteFlag(content) {
  atomicWrite(path.dirname(flagPath()), FLAG_NAME, content);
}

// Symlink-safe, size-capped read; true only when the flag holds "1".
function isOn() {
  try {
    const p = flagPath();
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile()) return false;
    if (st.size > MAX_FLAG_BYTES) return false;
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const fd = fs.openSync(p, fs.constants.O_RDONLY | O_NOFOLLOW);
    let out;
    try {
      const buf = Buffer.alloc(MAX_FLAG_BYTES);
      const n = fs.readSync(fd, buf, 0, MAX_FLAG_BYTES, 0);
      out = buf.slice(0, n).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
    return out.trim() === '1';
  } catch (e) {
    return false;
  }
}

// Symlink-safe flag delete. Best-effort.
function clearFlag() {
  try {
    const p = flagPath();
    if (fs.lstatSync(p).isSymbolicLink()) return; // not ours — leave it
    fs.unlinkSync(p);
  } catch (e) { /* already gone */ }
}

// Symlink-safe, size-capped read; any error or invalid entry falls back to
// {}; the file self-heals because the next write rewrites it with only the
// current entry
function readState() {
  try {
    const p = statePath();
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile()) return Object.create(null);
    if (st.size > MAX_STATE_BYTES) return Object.create(null);
    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const raw = fs.readFileSync(p, { encoding: 'utf8', flag: fs.constants.O_RDONLY | O_NOFOLLOW });
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return Object.create(null);
    // Null-prototype map so a hostile session_id like '__proto__' becomes a
    // plain own property instead of hitting the prototype setter.
    const state = Object.assign(Object.create(null), parsed);
    for (const key of Object.keys(state)) {
      const entry = state[key];
      if (typeof entry !== 'object' || entry === null ||
          !Number.isInteger(entry.turnCount) || entry.turnCount < 1) {
        return Object.create(null);
      }
    }
    return state;
  } catch (e) {
    return Object.create(null);
  }
}

// Write failure falls back to 1: degrade to the per-turn reminder
// (pre-cadence behavior) instead of pinning the counter on a stale multiple
// of 3, which would embed the full ruleset on every prompt
function bumpTurnCount(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return 1;
  const state = readState();
  const n = (state[sessionId] && state[sessionId].turnCount) || 0;
  state[sessionId] = { turnCount: n + 1 };
  if (!atomicWrite(claudeDir(), STATE_NAME, JSON.stringify(state))) return 1;
  return n + 1;
}

// Delete the entry; write only if it changed
function resetTurnCount(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return;
  const state = readState();
  if (!Object.prototype.hasOwnProperty.call(state, sessionId)) return;
  delete state[sessionId];
  atomicWrite(claudeDir(), STATE_NAME, JSON.stringify(state));
}

// Read SKILL.md at runtime so edits propagate without touching the hooks.
// Tried in order: 1. $CLAUDE_PLUGIN_ROOT/skills/skimmable/SKILL.md
// (Claude Code sets CLAUDE_PLUGIN_ROOT for hooks); 2. repo checkout
// ../../skills/skimmable/SKILL.md. Strips YAML frontmatter; '' if not found.
function readSkill() {
  const candidates = [];
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    candidates.push(path.join(process.env.CLAUDE_PLUGIN_ROOT, 'skills', 'skimmable', 'SKILL.md'));
  }
  candidates.push(path.join(__dirname, '..', '..', 'skills', 'skimmable', 'SKILL.md'));

  for (const candidate of candidates) {
    try {
      const content = fs.readFileSync(candidate, 'utf8');
      return content.replace(/^---[\s\S]*?---\s*/, '');
    } catch (e) { /* try next */ }
  }
  return '';
}

// Fallback ruleset when SKILL.md is missing.
const FALLBACK_RULES =
  'Format every reply for skimmability: short sentences, ' +
  'lists over paragraphs, code blocks for illustration. ' +
  'Off only: "stop skimmable" / "normal mode".';

module.exports = { claudeDir, flagPath, safeWriteFlag, isOn, clearFlag, readSkill, FALLBACK_RULES, readState, bumpTurnCount, resetTurnCount };
