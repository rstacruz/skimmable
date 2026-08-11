Compares output token counts of normal vs skimmable replies on a fixed set of 10 dev prompts (3 trials each). Results land in `benchmarks/results/` and `--update-readme` refreshes the table below.

```bash
cd benchmarks
pip install -r requirements.txt

# preview, no API calls
python run.py --dry-run

# Update readme
python run.py --update-readme --trials 3 --workers 5
```

Adapted from <https://github.com/JuliusBrussee/caveman/tree/main/benchmarks>.
