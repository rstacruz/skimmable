# Examples

Skimmable vs bare answers for the benchmark prompts (`benchmarks/prompts.json`).

## Generate

```bash
bun examples/generate.ts            # skimmable mode → examples/<id>.skimmable.md
bun examples/generate.ts --mode default   # bare → examples/<id>.default.md
bun examples/generate.ts --limit 3        # first 3 prompts
bun examples/generate.ts --out-dir /tmp/x # save elsewhere
```

## Flags

- `--mode [skimmable|default]` — inject skill (default) or bare `--system-prompt ""`
- `--limit <n>` — first N prompts
- `--force` — regenerate existing
- `--dry-run` — no API calls
- `MODEL=...` — pick a model

## Notes

- `default` is bare: no skill, no plugin hooks (`--setting-sources ""`)
- Bare output may still look structured — model's natural style
