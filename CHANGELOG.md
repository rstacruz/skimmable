# Changelog

## v1.1.0 - 2026-08-23

### ✨ Features

- **Output style replaces hooks**: skimmable now applies via a `force-for-plugin` output style (`output-styles/skimmable.md`) instead of the SessionStart/UserPromptSubmit hooks. The ruleset lives in the system prompt, survives compaction, and gets built-in per-turn adherence reminders. Subagent styling is dropped — output styles are main-conversation only.
- **PERSONALITY.md as the single source of truth**: the ruleset now lives in `PERSONALITY.md` and is synced into `skills/skimmable/SKILL.md` and `output-styles/skimmable.md` via `npm run sync`.

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
