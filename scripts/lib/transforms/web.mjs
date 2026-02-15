/**
 * transforms/web.mjs
 * Transforms DTCG token values for web consumption (CSS custom properties).
 *
 * color        → hex string "#2B81FC"
 * dimension    → string with unit "16px" / "0.875rem"
 * number       → number 0.48
 * fontFamily   → CSS font stack string
 * fontWeight   → number 700
 * shadow       → CSS box-shadow string
 * duration     → string "300ms"
 * cubicBezier  → CSS cubic-bezier() function
 */

/** Convert shadow layer object → CSS fragment */
function shadowLayerToCSS(layer) {
  return `${layer.offsetX} ${layer.offsetY} ${layer.blur} ${layer.spread} ${layer.color}`;
}

/**
 * @param {import('../parser.mjs').FlatToken} token
 * @returns {string|number} CSS-ready value
 */
export function transformValue(token) {
  switch (token.type) {
    case "color":
      return token.value;

    case "dimension":
      return token.value;

    case "number":
      return token.value;

    case "fontFamily":
      // $value is an array of strings → join to CSS font stack
      if (Array.isArray(token.value)) {
        return token.value
          .map((f) => (f.includes(" ") ? `"${f}"` : f))
          .join(", ");
      }
      return token.value;

    case "fontWeight":
      return token.value;

    case "shadow": {
      const v = token.value;
      // none → empty array
      if (Array.isArray(v) && v.length === 0) return "none";
      // single layer (object)
      if (!Array.isArray(v) && typeof v === "object") return shadowLayerToCSS(v);
      // multi layer (array of objects)
      if (Array.isArray(v)) return v.map(shadowLayerToCSS).join(", ");
      return "none";
    }

    case "duration":
      return token.value;

    case "cubicBezier": {
      const [x1, y1, x2, y2] = token.value;
      return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
    }

    default:
      return token.value;
  }
}
