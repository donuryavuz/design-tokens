/**
 * parser.mjs
 * Walks a W3C DTCG token tree and produces a flat list of resolved tokens.
 *
 * Each entry:
 *   { path: ['colors','neutral','500'], type: 'color', value: '#6B707A', extensions?: {...} }
 *
 * Supports $type inheritance: a $type on a group applies to all children
 * that don't declare their own $type.
 */

/**
 * @typedef {Object} FlatToken
 * @property {string[]} path      - e.g. ['colors', 'neutral', '500']
 * @property {string}   type      - W3C DTCG $type
 * @property {*}        value     - resolved $value
 * @property {string}   group     - top-level group key (e.g. 'colors')
 * @property {Object}   [extensions] - preserved $extensions metadata
 */

/**
 * Flatten a DTCG token tree.
 * @param {Object} tree           - DTCG root object
 * @param {Object} [opts]
 * @param {boolean} [opts.stripExtensions=false] - omit $extensions from output
 * @returns {FlatToken[]}
 */
export function flatten(tree, opts = {}) {
  const tokens = [];

  function walk(node, path, inheritedType, group) {
    const currentType = node.$type ?? inheritedType;

    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith("$")) continue;

      // Leaf token: has $value
      if (child != null && typeof child === "object" && "$value" in child) {
        const token = {
          path: [...path, key],
          type: child.$type ?? currentType,
          value: child.$value,
          group: group ?? path[0] ?? key,
        };
        if (!opts.stripExtensions && child.$extensions) {
          token.extensions = child.$extensions;
        }
        tokens.push(token);
      }
      // Group node: recurse
      else if (child != null && typeof child === "object") {
        walk(child, [...path, key], currentType, group ?? path[0] ?? key);
      }
    }
  }

  walk(tree, [], undefined, undefined);
  return tokens;
}

/**
 * Group flat tokens by their top-level group key.
 * Returns Map<string, FlatToken[]>
 */
export function groupByTopLevel(tokens) {
  const map = new Map();
  for (const t of tokens) {
    const key = t.path[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  return map;
}
