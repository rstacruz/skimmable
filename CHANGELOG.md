# Changelog

## v1.0.3 - 2026-08-13

### ✨ Features

- **Examples generator**: `examples/generate.ts` produces skimmable vs bare sample answers for every benchmark prompt (`--mode`, `--limit`, `--out-dir`).

### 🔧 Improvements

- **Bold conclusions**: replies now lead with a bold, single-sentence conclusion before the details (Minto style).
- **Examples refresh**: regenerated example outputs on Deepseek v4 Flash.

### 🛠 Internal

- Added `src/utils/` (claude call helper, promise queue); benchmarks and examples now run with zero external dependencies.

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
