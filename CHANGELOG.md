# Changelog

## (Unreleased)

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
