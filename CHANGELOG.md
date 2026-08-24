# Changelog

## v1.2.0 - 2026-08-24

### ✨ Features

- **Pi: skimmable is always on** — the ruleset (from `PERSONALITY.md`) is a permanent part of the system prompt, like oh-my-pi's `PERSONALITY.md`. Toggle and per-turn reminders removed.

## v1.1.0 - 2026-08-23

### ✨ Features

- **Output style replaces hooks**: skimmable now uses Clade Code Output Styles.

- **PERSONALITY.md**: the ruleset now lives in `PERSONALITY.md` for easy pasting into unsupported harnesses.

## v1.0.3 - 2026-08-13

### ✨ Features

- **Bold conclusions**: replies now lead with a bold, single-sentence conclusion before the details (Minto style).

### 🛠 Internal

- Regenerated skimmable vs bare example outputs for the docs.

## v1.0.2 - 2026-08-12

### 🔧 Improvements

- **Pi extension:** Use less tokens on long conversations by using short reminders.

## v1.0.1 - 2026-08-11

### 🔧 Improvements

- **Quieter mode activation**: Skimmable mode now turns on silently — Pi no longer posts a long “SKIMMABLE MODE ACTIVE” message with the full rules into the conversation.
- **Token cost transparency**: README now documents measured token impact (7% fewer tokens on Claude Sonnet 5, 40% more on Deepseek v4 Flash) with a per-task benchmark table.

### 🛠 Internal

- Ported benchmark script from Python to TypeScript.
- Renamed hook files to reflect their roles.

## v1.0.0 - 2026-08-11

Initial release
