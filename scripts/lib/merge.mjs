/**
 * merge.mjs
 * Deep-merges multiple W3C DTCG token trees.
 *
 * Strategy:
 *   - figma source is loaded first (base)
 *   - manual source is merged on top
 *   - if a top-level group key exists in BOTH sources, a warning is emitted
 *     and the figma version wins (Figma is the higher-priority source of truth)
 *   - if a group only exists in manual, it's added cleanly
 */

/**
 * @param {Object} figmaTokens  - normalised Figma export (primitives.figma.json)
 * @param {Object} manualTokens - hand-maintained tokens (primitives.manual.json)
 * @returns {{ merged: Object, warnings: string[] }}
 */
export function mergeTokenSources(figmaTokens, manualTokens) {
  const warnings = [];
  const merged = { ...figmaTokens };

  for (const [key, value] of Object.entries(manualTokens)) {
    if (key.startsWith("$")) continue;

    if (key in merged) {
      warnings.push(
        `⚠ Group "${key}" exists in both figma and manual sources. Figma version kept.`
      );
      // Figma wins — skip manual
      continue;
    }

    merged[key] = value;
  }

  return { merged, warnings };
}
