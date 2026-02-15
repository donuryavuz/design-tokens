/**
 * formatters/css.mjs
 * Generates a CSS file with custom properties from flat tokens.
 *
 * Output:
 *   :root {
 *     /* colors * /
 *     --colors-white: #FFFFFF;
 *     --colors-neutral-500: #6B707A;
 *     …
 *   }
 */

import { groupByTopLevel } from "../parser.mjs";

/** camelCase → kebab-case: "borderWidth" → "border-width" */
function toKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Build CSS variable name from token path.
 * ['colors', 'neutral', '500'] → '--colors-neutral-500'
 * Dot-notation keys are escaped: '0.5' → '0\\.5'
 */
function cssVarName(path) {
  return (
    "--" +
    path
      .map((segment) => {
        const kebab = toKebab(segment);
        // Escape dots in CSS custom property names
        return kebab.includes(".") ? kebab.replace(/\./g, "\\.") : kebab;
      })
      .join("-")
  );
}

/**
 * @param {import('../parser.mjs').FlatToken[]} tokens - flattened & transformed
 * @param {(token: import('../parser.mjs').FlatToken) => string|number} transformValue
 * @returns {string} CSS file content
 */
export function format(tokens, transformValue) {
  const groups = groupByTopLevel(tokens);
  const lines = [":root {"];

  for (const [groupKey, groupTokens] of groups) {
    lines.push(`  /* ${groupKey} */`);
    for (const token of groupTokens) {
      const varName = cssVarName(token.path);
      const value = transformValue(token);
      lines.push(`  ${varName}: ${value};`);
    }
    lines.push("");
  }

  // Remove trailing empty line before closing brace
  if (lines[lines.length - 1] === "") lines.pop();
  lines.push("}");

  return lines.join("\n") + "\n";
}
