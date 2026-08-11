# skimmable

Claude Code plugin that formats every reply for skimmability — short sentences, lists over paragraphs, code blocks for illustration. No user action needed; style only, content never rewritten.

## Install

```bash
/plugin install ~/Dev/skimmable
```

## Usage

Nothing to do — skimmable is on from the first prompt of every fresh session.

- **Turn it off** — say `stop skimmable` (or `normal mode`). Lasts the rest of the session.
- **Turn it back on** — say `skimmable`. Works mid-session, no restart.
- **New session** — on again by default.

## How it works

- **SessionStart hook** injects the ruleset (from `skills/skimmable/SKILL.md`) as hidden system context before the first prompt.
- **UserPromptSubmit hook** re-reinforces the style every turn, so it survives context compaction; it also implements the natural-language toggle.
- **State** is one flag file at `$CLAUDE_CONFIG_DIR/.skimmable-active` — exists = on, absent = off.

## What stays exact

Code, identifiers, paths, commands, URLs, error strings — all verbatim. The style formats, never rewrites. Security warnings and irreversible-action confirmations drop the formatting and use plain prose.

## Files

```
.claude-plugin/plugin.json    # hook manifest
src/hooks/skimmable-config.js # shared: flag helpers + SKILL.md resolver
src/hooks/skimmable-activate.js  # SessionStart hook
src/hooks/skimmable-tracker.js   # UserPromptSubmit hook
skills/skimmable/SKILL.md     # the behavior ruleset (mirrors the user skill)
```
