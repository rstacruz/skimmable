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
export const stripSkillMarkers = (content: string): string =>
  content
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/^## Skimmable output style\r?\n\r?\n/, "")
    .replace(/\r?\n<!-- end -->\r?\n?$/, "");
