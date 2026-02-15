/**
 * normalize.mjs
 * Transforms Figma Variables export JSON into W3C DTCG format.
 *
 * Figma quirks handled:
 *   - Color $value is an object { colorSpace, components[], alpha, hex }
 *     → normalised to a plain hex string (#RRGGBB or #RRGGBBAA)
 *   - Space / Radius / BorderWidth arrive as $type:"number"
 *     → retyped to "dimension" with a "px" unit suffix
 *   - Underscore keys (0_5) → dot notation (0.5)
 *   - PascalCase group keys → camelCase
 *   - $extensions preserved, com.figma.modeName stripped from root
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** PascalCase / Title → camelCase */
function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/** Underscore key → dot notation: "0_5" → "0.5" */
function normKey(key) {
  return key.replace(/_/g, ".");
}

/** Convert 0-1 alpha float to two-char hex. */
function alphaToHex(a) {
  return Math.round(a * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** Round a Figma float to a clean number (avoids 0.47999998927116394 → 0.48). */
function cleanNumber(n) {
  return parseFloat(n.toPrecision(6));
}

// ── Mapping: which Figma groups become which DTCG $type ──────────────────────

const DIMENSION_GROUPS = new Set(["Space", "Radius", "BorderWidth"]);
const NUMBER_GROUPS = new Set(["Opacity", "ZIndex"]);
const COLOR_GROUPS = new Set(["Colors"]);

// ── Core transform ───────────────────────────────────────────────────────────

function normalizeToken(token, groupName) {
  const result = {};

  // Preserve description if present
  if (token.$description) result.$description = token.$description;

  // ── Color ──
  if (COLOR_GROUPS.has(groupName) || token.$type === "color") {
    result.$type = "color";
    const v = token.$value;
    const hex = v.hex.toUpperCase();
    result.$value = v.alpha < 1 ? hex + alphaToHex(v.alpha) : hex;
  }
  // ── Dimension ──
  else if (DIMENSION_GROUPS.has(groupName)) {
    result.$type = "dimension";
    result.$value = `${token.$value}px`;
  }
  // ── Number ──
  else if (NUMBER_GROUPS.has(groupName)) {
    result.$type = "number";
    result.$value = cleanNumber(token.$value);
  }
  // Fallback
  else {
    result.$type = token.$type;
    result.$value = token.$value;
  }

  // Preserve Figma extensions metadata
  if (token.$extensions) {
    result.$extensions = token.$extensions;
  }

  return result;
}

/** Is this node a leaf token? (has $value) */
function isToken(node) {
  return node != null && typeof node === "object" && "$value" in node;
}

/**
 * Recursively walk a Figma export group and produce DTCG-normalised output.
 * `groupName` is the original PascalCase Figma group ("Colors", "Space", …).
 */
function walkGroup(node, groupName) {
  if (isToken(node)) {
    return normalizeToken(node, groupName);
  }

  const out = {};
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue; // skip $type at group level in source
    out[normKey(key)] = walkGroup(child, groupName);
  }
  return out;
}

// ── Group-level $type injection ──────────────────────────────────────────────

const GROUP_TYPE_MAP = {
  Colors: "color",
  Space: "dimension",
  Radius: "dimension",
  BorderWidth: "dimension",
  Opacity: "number",
  ZIndex: "number",
};

// ── Main ─────────────────────────────────────────────────────────────────────

export function normalize(figmaJson) {
  const output = {};

  for (const [groupKey, groupValue] of Object.entries(figmaJson)) {
    if (groupKey.startsWith("$")) continue; // skip root $extensions

    const camelKey = toCamelCase(groupKey);
    const dtcgType = GROUP_TYPE_MAP[groupKey];

    const normalizedGroup = walkGroup(groupValue, groupKey);

    // Inject group-level $type (W3C DTCG allows type inheritance)
    if (dtcgType) {
      output[camelKey] = { $type: dtcgType, ...normalizedGroup };
    } else {
      output[camelKey] = normalizedGroup;
    }
  }

  return output;
}

// ── CLI entry ────────────────────────────────────────────────────────────────

const inputPath = process.argv[2] || resolve(__dirname, "../figma-export/Default.tokens.json");
const outputPath = process.argv[3] || resolve(__dirname, "../tokens/primitives.figma.json");

const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
const result = normalize(raw);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf-8");

console.log(`✓ Normalized ${inputPath}\n  → ${outputPath}`);
