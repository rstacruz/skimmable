# skimmable

Claude Code plugin that formats every reply for skimmability — short sentences, lists over paragraphs, code blocks for illustration. No user action needed; style only, content never rewritten.

## Install

```bash
git clone https://github.com/rstacruz/skimmable.git ~/.local/share/skimmable

# in claude code:
/plugin install ~/.local/share/skimmable
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

## Special thanks

This plugin is based off of [caveman](https://github.com/JuliusBrussee/caveman/tree/main) by [JuliusBrussee](https://github.com/JuliusBrussee).
