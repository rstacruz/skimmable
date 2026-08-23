# AGENTS.md

## Synced ruleset — edit `PERSONALITY.md`, not the copies

`PERSONALITY.md` is the single source of truth for the skimmable ruleset. The
region between `## Skimmable output style` and `<!-- end -->` is synced into
two generated copies:

- `skills/skimmable/SKILL.md`
- `output-styles/skimmable.md`

**Never edit those regions directly.** Edit `PERSONALITY.md`, then run:

```bash
just sync
```

`just check` — and CI (`sync-check` workflow) — fail when the copies drift.
