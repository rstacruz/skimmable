#!/usr/bin/env node
// skimmable — shared helpers for the skimmable hooks
//
// State: one flag file at $CLAUDE_CONFIG_DIR/.skimmable-active.
//   exists → ON (default: written at session start); absent → OFF.
// Every helper silent-fails — hooks must never block session start or
// prompt submission.

const fs = require('fs');
const path = require('path');
const os = require('os');

const FLAG_NAME = '.skimmable-active';
const MAX_FLAG_BYTES = 64;

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function flagPath() {
  return path.join(claudeDir(), FLAG_NAME);
}

// Symlink-safe write: refuse a symlinked flag target (clobber vector);
// resolve a symlinked parent dir and verify ownership — legit ~/.claude
// works, attacker-planted refused. O_NOFOLLOW, atomic temp+rename, 0600.
// Silent-fails.
function safeWriteFlag(content) {
  try {
    const dir = path.dirname(flagPath());
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

    const realFlag = path.join(realDir, FLAG_NAME);
    try {
      if (fs.lstatSync(realFlag).isSymbolicLink()) return;
    } catch (e) {
      if (e.code !== 'ENOENT') return;
    }

    const O_NOFOLLOW = typeof fs.constants.O_NOFOLLOW === 'number' ? fs.constants.O_NOFOLLOW : 0;
    const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | O_NOFOLLOW;
    const temp = path.join(realDir, `${FLAG_NAME}.${process.pid}.${Date.now()}`);
    let fd;
    try {
      fd = fs.openSync(temp, flags, 0o600);
      fs.writeSync(fd, String(content));
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
    try {
      fs.renameSync(temp, realFlag);
    } finally {
      try { fs.unlinkSync(temp); } catch (e) { /* already renamed */ }
    }
  } catch (e) {
    // Silent fail — flag is best-effort
  }
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

module.exports = { claudeDir, flagPath, safeWriteFlag, isOn, clearFlag, readSkill, FALLBACK_RULES };
