# AGENTS.md

## Managing changelog

- When implementing new features, update CHANGELOG.md to add it under `## Unreleased` (create this heading if it doesn't exist).

## Synced ruleset — edit `PERSONALITY.md`, not the copies

`PERSONALITY.md` is the single source of truth for the skimmable ruleset. It's synced into:

- `skills/skimmable/SKILL.md`
- `output-styles/skimmable.md`

**Never edit those regions directly.** Edit `PERSONALITY.md`, then run `npm run sync`.

## Lint/test

Basic tests: `npm run check`
