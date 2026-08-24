/**
 * Shared skill-file handling for everything that injects the skimmable
 * ruleset (pi extension, benchmarks, example generator). One implementation
 * so the prompt benchmarks measure is byte-identical to what ships.
 */

/**
 * Strip YAML frontmatter, then the sync markers (heading + end comment, with
 * their adjacent blank lines) so the injected prompt is byte-identical to the
 * pre-marker ruleset.
 *
 * Canonical anchoring: frontmatter and heading are anchored at the start of
 * the file, the end marker at the end — no unanchored matches that could
 * truncate a body containing either marker.
 */
/**
 * Extract the synced "Skimmable output style" region from a
 * PERSONALITY.md-style file, stripping the region markers. Falls back to
 * the trimmed verbatim content when the markers are absent, so a
 * hand-written ruleset file is injected as-is.
 */
export const extractRuleset = (content: string): string => {
  const region = content.match(
    /^## Skimmable output style\r?\n([\s\S]*?)\r?\n<!-- end -->/,
  );
  return (region?.[1] ?? content).trim();
};
