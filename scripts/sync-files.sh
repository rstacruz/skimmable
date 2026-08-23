#!/usr/bin/env bash
# Sync the "Skimmable output style" region across its three copies.
#
# PERSONALITY.md is the canonical source. The synced region is the lines
# between `## Skimmable output style` and `<!-- end -->` (both inclusive);
# skills/skimmable/SKILL.md and output-styles/skimmable.md each carry the
# same region wrapped in their own frontmatter. The region is replaced
# wholesale in each target, so PERSONALITY.md is the single source of truth.

set -euo pipefail

check_only=0
for arg in "$@"; do
  case "$arg" in
    --check) check_only=1 ;;
    *) echo "usage: $0 [--check]" >&2; exit 2 ;;
  esac
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source="$root/PERSONALITY.md"
targets=("$root/skills/skimmable/SKILL.md" "$root/output-styles/skimmable.md")
start='## Skimmable output style'
end='<!-- end -->'

# Every file must carry exactly one start marker and one end marker, so a
# stray marker inside the body can never silently truncate the extraction.
for f in "$source" "${targets[@]}"; do
  [ -f "$f" ] || { echo "error: missing $f" >&2; exit 1; }
  [ "$(grep -c -F "$start" "$f")" -eq 1 ] || { echo "error: expected exactly one '$start' in $f" >&2; exit 1; }
  [ "$(grep -c -F "$end" "$f")" -eq 1 ] || { echo "error: expected exactly one '$end' in $f" >&2; exit 1; }
done

tmp_spec="$(mktemp "${TMPDIR:-/tmp}/skimmable-sync.XXXXXX")"
tmp_files=()
trap 'rm -f "$tmp_spec" "${tmp_files[@]}"' EXIT

# Extract the canonical region (markers included) from PERSONALITY.md.
sed -n "/$start/,/$end/p" "$source" > "$tmp_spec"

out_of_sync=0
for target in "${targets[@]}"; do
  tmp="$(mktemp "${TMPDIR:-/tmp}/skimmable-sync.XXXXXX")"
  tmp_files+=("$tmp")

  # Splice the canonical region into the target, replacing its existing region.
  awk -v spec_file="$tmp_spec" -v start="$start" -v end="$end" '
    BEGIN { while ((getline line < spec_file) > 0) spec[++n] = line }
    index($0, start) {
      for (i = 1; i <= n; i++) print spec[i]
      in_spec = 1
      next
    }
    in_spec && index($0, end) { in_spec = 0; next }
    in_spec { next }
    { print }
  ' "$target" > "$tmp"

  # Sanity: the splice must not have dropped the markers.
  [ "$(grep -c -F "$start" "$tmp")" -eq 1 ] || { echo "error: splice failed for $target" >&2; exit 1; }
  [ "$(grep -c -F "$end" "$tmp")" -eq 1 ] || { echo "error: splice failed for $target" >&2; exit 1; }

  if [ "$check_only" -eq 1 ]; then
    if cmp -s "$tmp" "$target"; then
      echo "in sync: ${target#"$root"/}"
    else
      echo "out of sync: ${target#"$root"/} (run $0 to update)" >&2
      out_of_sync=1
    fi
  else
    # cp, not mv: mktemp files are 0600 and mv would carry that mode over the
    # target; cp into an existing file keeps the target's mode.
    cp "$tmp" "$target"
    echo "synced region from PERSONALITY.md into ${target#"$root"/}"
  fi
done

if [ "$check_only" -eq 1 ]; then
  [ "$out_of_sync" -eq 1 ] && exit 1
  echo "all files in sync"
fi
