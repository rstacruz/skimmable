#!/usr/bin/env python3
"""Benchmark skimmable vs normal Claude output token counts.

Adapted from https://github.com/JuliusBrussee/caveman/tree/main/benchmarks

Runs `claude -p --bare` (no API key needed). --bare skips hooks and plugin
sync, so the globally-installed skimmable plugin can't contaminate the
"normal" baseline; the ruleset is injected explicitly with
--append-system-prompt, mirroring how the plugin's SessionStart hook ships it.
"""

import argparse
import hashlib
import itertools
import json
import shutil
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_VERSION = "1.2.0"
SCRIPT_DIR = Path(__file__).parent
REPO_DIR = SCRIPT_DIR.parent
PROMPTS_PATH = SCRIPT_DIR / "prompts.json"
SKILL_PATH = REPO_DIR / "skills" / "skimmable" / "SKILL.md"
README_PATH = REPO_DIR / "README.md"
RESULTS_DIR = SCRIPT_DIR / "results"

BENCHMARK_START = "<!-- BENCHMARK-TABLE-START -->"
BENCHMARK_END = "<!-- BENCHMARK-TABLE-END -->"

CALL_TIMEOUT = 300  # seconds per claude -p call


def load_prompts():
    with open(PROMPTS_PATH) as f:
        data = json.load(f)
    return data["prompts"]


def load_skimmable_system():
    content = SKILL_PATH.read_text()
    # Match src/hooks/skimmable-config.js: YAML frontmatter is stripped
    # before the ruleset is injected, so benchmark what actually ships.
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) == 3:
            content = parts[2]
    return content


def sha256_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def claude_version():
    try:
        return subprocess.run(
            ["claude", "--version"], capture_output=True, text=True, timeout=15
        ).stdout.strip()
    except Exception:
        return "unknown"


def call_claude(prompt, system_prompt, model=None, cwd=None, max_retries=3):
    """One `claude -p --bare --output-format json` call, with retry."""
    delays = [5, 10, 20]
    cmd = ["claude", "-p", "--bare", "--output-format", "json"]
    if model:
        cmd += ["--model", model]
    if system_prompt:
        cmd += ["--append-system-prompt", system_prompt]
    cmd += [prompt]

    for attempt in range(max_retries + 1):
        try:
            proc = subprocess.run(
                cmd, capture_output=True, text=True, timeout=CALL_TIMEOUT, cwd=cwd
            )
            data = json.loads(proc.stdout)
            if proc.returncode != 0 or data.get("is_error"):
                raise RuntimeError(
                    f"exit={proc.returncode} stderr={proc.stderr[-300:]!r}"
                )
            return {
                "input_tokens": data["usage"]["input_tokens"],
                "output_tokens": data["usage"]["output_tokens"],
                "text": data.get("result", ""),
                "stop_reason": data.get("stop_reason"),
            }
        except (json.JSONDecodeError, RuntimeError, subprocess.TimeoutExpired, KeyError) as e:
            if attempt < max_retries:
                delay = delays[min(attempt, len(delays) - 1)]
                print(f"  Call failed ({e}), retrying in {delay}s...", file=sys.stderr)
                time.sleep(delay)
            else:
                raise


def run_benchmarks(prompts, skimmable_system, trials, model, work_dir, workers):
    """Run all calls concurrently (up to `workers` claude -p at a time).

    Normal/skimmable trials are interleaved per prompt so both modes see the
    same rate-limit drift. Trials complete out of order; results are re-sorted
    by trial index before returning.
    """
    total = len(prompts) * 2 * trials

    units = []
    for i, prompt_entry in enumerate(prompts, 1):
        for t in range(1, trials + 1):
            for mode, system in [("normal", None), ("skimmable", skimmable_system)]:
                units.append((i, prompt_entry["id"], prompt_entry["prompt"], mode, system, t))

    per_prompt = {
        p["id"]: {"id": p["id"], "category": p["category"], "prompt": p["prompt"],
                  "normal": [], "skimmable": []}
        for p in prompts
    }

    print_lock = threading.Lock()
    counter = itertools.count(1)

    def run_unit(unit):
        i, pid, prompt, mode, system, t = unit
        with print_lock:
            print(
                f"  [{next(counter)}/{total}] {pid} | {mode} | trial {t}/{trials}",
                file=sys.stderr,
                flush=True,
            )
        # Scratch subdir per trial so concurrent model writes can't collide.
        cwd = tempfile.mkdtemp(prefix="trial-", dir=work_dir)
        try:
            result = call_claude(prompt, system, model=model, cwd=cwd)
        finally:
            shutil.rmtree(cwd, ignore_errors=True)
        return pid, mode, t, result

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(run_unit, u): u for u in units}
        try:
            for fut in as_completed(futures):
                pid, mode, t, result = fut.result()
                per_prompt[pid][mode].append((t, result))
        except Exception:
            for f in futures:
                f.cancel()
            raise

    return [
        {
            "id": e["id"],
            "category": e["category"],
            "prompt": e["prompt"],
            "normal": [r for _, r in sorted(e["normal"])],
            "skimmable": [r for _, r in sorted(e["skimmable"])],
        }
        for e in per_prompt.values()
    ]


def compute_stats(results):
    rows = []
    all_savings = []

    for entry in results:
        normal_medians = statistics.median(
            [t["output_tokens"] for t in entry["normal"]]
        )
        skimmable_medians = statistics.median(
            [t["output_tokens"] for t in entry["skimmable"]]
        )
        savings = (
            1 - (skimmable_medians / normal_medians) if normal_medians > 0 else 0
        )
        all_savings.append(savings)

        rows.append(
            {
                "id": entry["id"],
                "category": entry["category"],
                "prompt": entry["prompt"],
                "normal_median": int(normal_medians),
                "skimmable_median": int(skimmable_medians),
                "savings_pct": round(savings * 100),
            }
        )

    avg_savings = round(statistics.mean(all_savings) * 100)
    min_savings = round(min(all_savings) * 100)
    max_savings = round(max(all_savings) * 100)
    avg_normal = round(statistics.mean([r["normal_median"] for r in rows]))
    avg_skimmable = round(statistics.mean([r["skimmable_median"] for r in rows]))

    return rows, {
        "avg_savings": avg_savings,
        "min_savings": min_savings,
        "max_savings": max_savings,
        "avg_normal": avg_normal,
        "avg_skimmable": avg_skimmable,
    }


def format_prompt_label(prompt_id):
    labels = {
        "react-rerender": "Explain React re-render bug",
        "auth-middleware-fix": "Fix auth middleware token expiry",
        "postgres-pool": "Set up PostgreSQL connection pool",
        "git-rebase-merge": "Explain git rebase vs merge",
        "async-refactor": "Refactor callback to async/await",
        "microservices-monolith": "Architecture: microservices vs monolith",
        "pr-security-review": "Review PR for security issues",
        "docker-multi-stage": "Docker multi-stage build",
        "race-condition-debug": "Debug PostgreSQL race condition",
        "error-boundary": "Implement React error boundary",
    }
    return labels.get(prompt_id, prompt_id)


def format_table(rows, summary):
    lines = [
        "| Task | Normal (tokens) | Skimmable (tokens) | Saved |",
        "|------|---------------:|-------------------:|------:|",
    ]
    for r in rows:
        label = format_prompt_label(r["id"])
        lines.append(
            f"| {label} | {r['normal_median']} | {r['skimmable_median']} | {r['savings_pct']}% |"
        )
    lines.append(
        f"| **Average** | **{summary['avg_normal']}** | **{summary['avg_skimmable']}** | **{summary['avg_savings']}%** |"
    )
    lines.append("")
    lines.append(
        f"*Range: {summary['min_savings']}%–{summary['max_savings']}% savings across prompts.*"
    )
    return "\n".join(lines)


def save_results(results, rows, summary, model, trials, skill_hash):
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    output = {
        "metadata": {
            "script_version": SCRIPT_VERSION,
            "claude_version": claude_version(),
            "model": model or "default",
            "date": datetime.now(timezone.utc).isoformat(),
            "trials": trials,
            "skill_md_sha256": skill_hash,
        },
        "summary": summary,
        "rows": rows,
        "raw": results,
    }
    path = RESULTS_DIR / f"benchmark_{ts}.json"
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(output, f, indent=2)
    return path


def update_readme(table_md):
    content = README_PATH.read_text()
    start_idx = content.find(BENCHMARK_START)
    end_idx = content.find(BENCHMARK_END)
    if start_idx == -1 or end_idx == -1:
        print(
            "ERROR: Benchmark markers not found in README.md",
            file=sys.stderr,
        )
        sys.exit(1)

    before = content[: start_idx + len(BENCHMARK_START)]
    after = content[end_idx:]
    new_content = before + "\n" + table_md + "\n" + after
    README_PATH.write_text(new_content)
    print("README.md updated.", file=sys.stderr)


def dry_run(prompts, model, trials, workers):
    print(f"Model:  {model or 'default'}")
    print(f"Trials: {trials}")
    print(f"Prompts: {len(prompts)}")
    print(f"Workers: {workers}")
    print(f"Total API calls: {len(prompts) * 2 * trials}")
    print(f"Runs: claude -p --bare{' --model ' + model if model else ''}")
    print()
    for p in prompts:
        print(f"  [{p['id']}] ({p['category']})")
        preview = p["prompt"][:80]
        if len(p["prompt"]) > 80:
            preview += "..."
        print(f"    {preview}")
    print()
    print("Dry run complete. No API calls made.")


def main():
    parser = argparse.ArgumentParser(description="Benchmark skimmable vs normal Claude")
    parser.add_argument("--trials", type=int, default=3, help="Trials per prompt per mode (default: 3)")
    parser.add_argument("--dry-run", action="store_true", help="Print config, no API calls")
    parser.add_argument("--update-readme", action="store_true", help="Update README.md benchmark table")
    parser.add_argument("--model", default=None, help="Model to use (default: claude's configured model)")
    parser.add_argument("--workers", type=int, default=5, help="Concurrent claude -p calls (default: 5)")
    args = parser.parse_args()

    prompts = load_prompts()

    if args.dry_run:
        dry_run(prompts, args.model, args.trials, args.workers)
        return

    skimmable_system = load_skimmable_system()
    skill_hash = sha256_file(SKILL_PATH)

    # Run calls from a scratch dir so the model's writes (if any) never
    # touch the repo.
    work_dir = tempfile.mkdtemp(prefix="skimmable-bench-")
    try:
        print(f"Running benchmarks: {len(prompts)} prompts x 2 modes x {args.trials} trials ({args.workers} concurrent)", file=sys.stderr)
        print(f"Model: {args.model or 'default'} | claude {claude_version()}", file=sys.stderr)
        print(file=sys.stderr)

        results = run_benchmarks(prompts, skimmable_system, args.trials, args.model, work_dir, args.workers)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    rows, summary = compute_stats(results)
    table_md = format_table(rows, summary)

    json_path = save_results(results, rows, summary, args.model, args.trials, skill_hash)
    print(f"\nResults saved to {json_path}", file=sys.stderr)

    if args.update_readme:
        update_readme(table_md)

    print(table_md)


if __name__ == "__main__":
    main()
