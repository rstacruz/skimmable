Compares output token counts of normal vs skimmable replies on a fixed set of 10 dev prompts (3 trials each). Results land in `benchmarks/results/` and `--update-readme` refreshes the table below.

```bash
cd benchmarks
bun install

# preview, no API calls
bun run.ts --dry-run

# Update readme
bun run.ts --update-readme --trials 3 --workers 5
```

The script is a Bun/TypeScript port of the original `run.py` (still in this dir until parity is confirmed); worker concurrency uses `p-queue`.

Adapted from <https://github.com/JuliusBrussee/caveman/tree/main/benchmarks>.
