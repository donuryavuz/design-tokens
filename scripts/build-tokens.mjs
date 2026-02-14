#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const BASE_REM_PX = 16;

// ---- IO ----
const SRC = path.resolve("tokens/source/primitives-core.source.json");
const OUT_DIR = path.resolve("tokens-dist");
const OUT_RUNTIME = path.join(OUT_DIR, "primitives-core.runtime.json");
const OUT_FIGMA = path.join(OUT_DIR, "primitives-core.figma.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

// ---- helpers ----
function isTokenObject(v) {
  return v && typeof v === "object" && ("$type" in v) && ("value" in v);
}

function remToPxNumber(remString) {
  // "1.25rem" -> 20
  const n = Number(String(remString).trim().replace("rem", ""));
  return Math.round(n * BASE_REM_PX * 1000) / 1000;
}

function pxStringToNumber(pxString) {
  // "16px" -> 16
  const n = Number(String(pxString).trim().replace("px", ""));
  return Math.round(n * 1000) / 1000;
}

function rgbaToHex8(rgba) {
  // "rgba(14, 17, 22, 0.12)" -> "#0E11161F"
  const m = String(rgba).match(
    /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/
  );
  if (!m) return rgba;
  const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]), a = Number(m[4]);
  const alpha = Math.max(0, Math.min(1, a));
  const aa = Math.round(alpha * 255);
  const hex = (x) => x.toString(16).padStart(2, "0").toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}${hex(aa)}`;
}

// ---- transforms ----
function buildRuntime(source) {
  // Runtime tarafı: source’u olduğu gibi kullan (rem/motion/shadow dahil).
  // İstersen burada normalize yaparsın ama şart değil.
  return source;
}

function buildFigma(source) {
  // Figma tarafı: Figma variable tipi olmayan/parse sorun çıkaran kısımları filtrele + rem->px.
  const root = structuredClone(source);

  // Eğer source root’u {"Primitives.Core": {...}} gibi wrapper içeriyorsa otomatik düzelt.
  const core =
    root["Primitives.Core"] ??
    root["Primitives_Core"] ??
    root["primitivesCore"] ??
    root;

  const figma = {};

  // 1) Color: rgba() -> hex8 (Figma daha stabil)
  if (core.color) {
    const convertColorTree = (node) => {
      if (isTokenObject(node) && node.$type === "color") {
        const v = node.value;
        if (typeof v === "string" && v.startsWith("rgba(")) {
          return { $type: "color", value: rgbaToHex8(v) };
        }
        return node;
      }
      if (node && typeof node === "object" && !Array.isArray(node)) {
        const out = {};
        for (const [k, v] of Object.entries(node)) out[k] = convertColorTree(v);
        return out;
      }
      return node;
    };
    figma.color = convertColorTree(core.color);
  }

  // 2) Dimension numeric px isteyenler: space, radius, borderWidth
  for (const key of ["space", "radius", "borderWidth"]) {
    if (!core[key]) continue;
    figma[key] = {};
    for (const [k, token] of Object.entries(core[key])) {
      if (!isTokenObject(token)) continue;
      const v = token.value;
      let px;
      if (typeof v === "number") px = v;
      else if (typeof v === "string" && v.endsWith("rem")) px = remToPxNumber(v);
      else if (typeof v === "string" && v.endsWith("px")) px = pxStringToNumber(v);
      else continue;
      figma[key][k] = { $type: "dimension", value: px };
    }
  }

  // 3) Simple numeric: opacity, zIndex
  for (const key of ["opacity", "zIndex"]) {
    if (core[key]) figma[key] = core[key];
  }

  // 4) Typography (figma-safe subset)
  // Figma’da fontFamily/letterSpacing/motion/shadow çoğu ekipte variable olarak push edilmiyor.
  // fontSize + lineHeight (px number) + fontWeight push etmek yeterli.
  if (core.typography) {
    const t = core.typography;
    const outT = {};

    if (t.fontWeight) outT.fontWeight = t.fontWeight;

    // fontSize: rem/px string -> px number dimension
    if (t.fontSize) {
      outT.fontSize = {};
      for (const [k, token] of Object.entries(t.fontSize)) {
        if (!isTokenObject(token)) continue;
        const v = token.value;
        let px;
        if (typeof v === "number") px = v;
        else if (typeof v === "string" && v.endsWith("rem")) px = remToPxNumber(v);
        else if (typeof v === "string" && v.endsWith("px")) px = pxStringToNumber(v);
        else continue;
        outT.fontSize[k] = { $type: "dimension", value: px };
      }
    }

    // lineHeight: sadece px değerleri push et (none/snug vb ratio’ları atla)
    if (t.lineHeight) {
      outT.lineHeight = {};
      for (const [k, token] of Object.entries(t.lineHeight)) {
        if (!isTokenObject(token)) continue;
        const v = token.value;

        // ratio’lar (1.5 gibi) Figma text line-height’a bağlanamadığı için atlıyoruz:
        if (typeof v === "number") continue;

        let px;
        if (typeof v === "string" && v.endsWith("rem")) px = remToPxNumber(v);
        else if (typeof v === "string" && v.endsWith("px")) px = pxStringToNumber(v);
        else continue;

        outT.lineHeight[k] = { $type: "dimension", value: px };
      }
    }

    if (Object.keys(outT).length) figma.typography = outT;
  }

  // 5) Exclude: motion + shadow (Figma variable tipi değil / transformer crash riski)
  // (İstersen daha sonra Styles pipeline ile yönetirsin.)
  return figma;
}

// ---- run ----
const source = readJson(SRC);

const runtime = buildRuntime(source);
const figma = buildFigma(source);

writeJson(OUT_RUNTIME, runtime);
writeJson(OUT_FIGMA, figma);

console.log("✅ Tokens built:");
console.log(" -", OUT_RUNTIME);
console.log(" -", OUT_FIGMA);
