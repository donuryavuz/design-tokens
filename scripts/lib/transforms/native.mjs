/**
 * transforms/native.mjs
 * Transforms DTCG token values for React Native / Unistyles consumption.
 *
 * color        → hex string "#2B81FC"
 * dimension    → unitless number (16) — rem converted to px at 16px base
 * number       → number 0.48
 * fontFamily   → platform-specific font name from $extensions.com.kunduz.nativeMapping
 * fontWeight   → string "700" (RN expects fontWeight as string)
 * shadow       → RN shadow object { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }
 * duration     → unitless number in ms (300)
 * cubicBezier  → array [x1, y1, x2, y2]
 */

const REM_BASE = 16;

/** Parse dimension string → number in px. Handles px, rem, em. */
function dimensionToNumber(dimValue) {
  if (typeof dimValue === "number") return dimValue;
  const str = String(dimValue).trim();
  if (str.endsWith("rem")) return parseFloat(str) * REM_BASE;
  if (str.endsWith("em")) return parseFloat(str) * REM_BASE;
  return parseFloat(str);
}

/** Parse duration string → number in ms. */
function durationToNumber(durValue) {
  if (typeof durValue === "number") return durValue;
  const str = String(durValue).trim();
  if (str.endsWith("ms")) return parseFloat(str);
  if (str.endsWith("s")) return parseFloat(str) * 1000;
  return parseFloat(str);
}

/** Parse hex8 color → { color (hex6), opacity (0-1) } */
function parseHexAlpha(hex) {
  if (hex.length === 9) {
    // #RRGGBBAA
    const alphaHex = hex.slice(7, 9);
    return {
      color: hex.slice(0, 7),
      opacity: parseInt(alphaHex, 16) / 255,
    };
  }
  return { color: hex.slice(0, 7), opacity: 1 };
}

/** Rough elevation mapping from shadow blur for Android. */
function blurToElevation(blur) {
  if (blur <= 1) return 1;
  if (blur <= 3) return 2;
  if (blur <= 6) return 4;
  if (blur <= 12) return 6;
  if (blur <= 24) return 8;
  if (blur <= 48) return 12;
  return 16;
}

/** Convert DTCG shadow layer → RN shadow props. Uses the largest layer for multi-shadow. */
function shadowToRN(shadowValue) {
  if (Array.isArray(shadowValue) && shadowValue.length === 0) {
    return {
      shadowColor: "transparent",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    };
  }

  // For multi-layer shadows, use the last (largest) layer as primary
  const layer = Array.isArray(shadowValue)
    ? shadowValue[shadowValue.length - 1]
    : shadowValue;

  const { color, opacity } = parseHexAlpha(layer.color);
  const blur = parseFloat(layer.blur);

  return {
    shadowColor: color,
    shadowOffset: {
      width: parseFloat(layer.offsetX),
      height: parseFloat(layer.offsetY),
    },
    shadowOpacity: Math.round(opacity * 1000) / 1000,
    shadowRadius: blur,
    elevation: blurToElevation(blur),
  };
}

/**
 * @param {import('../parser.mjs').FlatToken} token
 * @returns {*} RN-ready value
 */
export function transformValue(token) {
  switch (token.type) {
    case "color":
      return token.value;

    case "dimension":
      return dimensionToNumber(token.value);

    case "number":
      return token.value;

    case "fontFamily": {
      // Use native mapping if available, fallback to first font in array
      const mapping = token.extensions?.["com.kunduz.nativeMapping"];
      if (mapping) {
        return { ios: mapping.ios, android: mapping.android };
      }
      return Array.isArray(token.value) ? token.value[0] : token.value;
    }

    case "fontWeight":
      // React Native expects fontWeight as string
      return String(token.value);

    case "shadow":
      return shadowToRN(token.value);

    case "duration":
      return durationToNumber(token.value);

    case "cubicBezier":
      // RN Animated / Reanimated uses [x1, y1, x2, y2] directly
      return token.value;

    default:
      return token.value;
  }
}
