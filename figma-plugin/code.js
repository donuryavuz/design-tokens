// figma-plugin/code.js
// Repo Token Sync (Single Collection: Primitives) + Create Styles (Text + Effect)
// Mode name = "Default"
// TextStyle naming: "Typography/Text Sm" (Title Case + spaces)
// ES5-compatible

figma.showUI(__html__, { width: 420, height: 360 });

function postLog(message) {
  figma.ui.postMessage({ type: "log", message: message });
}

function isTokenObject(v) {
  return v && typeof v === "object" && v.$type && Object.prototype.hasOwnProperty.call(v, "value");
}

function walk(obj, prefix) {
  prefix = prefix || [];
  var out = [];
  for (var k in obj) {
    var v = obj[k];
    if (isTokenObject(v)) out.push({ path: prefix.concat([k]), token: v });
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      var nested = walk(v, prefix.concat([k]));
      for (var i = 0; i < nested.length; i++) out.push(nested[i]);
    }
  }
  return out;
}

function hexToRgba01(hex) {
  var h = String(hex).replace("#", "").trim();
  if (h.length !== 6 && h.length !== 8) throw new Error("Bad hex: " + hex);

  var r = parseInt(h.slice(0, 2), 16) / 255;
  var g = parseInt(h.slice(2, 4), 16) / 255;
  var b = parseInt(h.slice(4, 6), 16) / 255;
  var a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;

  return { r: r, g: g, b: b, a: a };
}

function parsePxNumber(v) {
  if (typeof v === "number") return v;
  if (!v) return null;
  var s = String(v).trim();
  if (s.endsWith("px")) return parseFloat(s.slice(0, -2));
  if (!isNaN(Number(s))) return Number(s);
  return null;
}

function parseRgba01(str) {
  var s = String(str).trim();
  var m = s.match(/^rgba\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\)$/i);
  if (!m) throw new Error("Bad rgba: " + str);
  var r = Number(m[1]) / 255;
  var g = Number(m[2]) / 255;
  var b = Number(m[3]) / 255;
  var a = Number(m[4]);
  return { r: r, g: g, b: b, a: a };
}

function ensureCollection(name) {
  var collections = figma.variables.getLocalVariableCollections();
  for (var i = 0; i < collections.length; i++) {
    if (collections[i].name === name) {
      postLog("ℹ️ Collection found: " + name);
      return collections[i];
    }
  }
  var col = figma.variables.createVariableCollection(name);
  postLog("✅ Collection created: " + name);
  return col;
}

function ensureMode(collection, modeName) {
  var modes = collection.modes || [];
  for (var i = 0; i < modes.length; i++) {
    if (modes[i].name === modeName) return modes[i].modeId;
  }
  var newModeId = collection.addMode(modeName);
  postLog("✅ Mode created: " + modeName);
  return newModeId;
}

function findVariableByName(collectionId, name) {
  var vars = figma.variables.getLocalVariables();
  for (var i = 0; i < vars.length; i++) {
    var v = vars[i];
    if (v.variableCollectionId === collectionId && v.name === name) return v;
  }
  return null;
}

function upsertColor(collection, modeId, name, rgba) {
  var existing = findVariableByName(collection.id, name);
  if (!existing) {
    var v = figma.variables.createVariable(name, collection.id, "COLOR");
    v.setValueForMode(modeId, rgba);
    return "created";
  } else {
    existing.setValueForMode(modeId, rgba);
    return "updated";
  }
}

function upsertFloat(collection, modeId, name, value) {
  var existing = findVariableByName(collection.id, name);
  if (!existing) {
    var v = figma.variables.createVariable(name, collection.id, "FLOAT");
    v.setValueForMode(modeId, value);
    return "created";
  } else {
    existing.setValueForMode(modeId, value);
    return "updated";
  }
}

// ---------- STYLE HELPERS ----------

function findTextStyleByName(name) {
  var styles = figma.getLocalTextStyles();
  for (var i = 0; i < styles.length; i++) {
    if (styles[i].name === name) return styles[i];
  }
  return null;
}

function findEffectStyleByName(name) {
  var styles = figma.getLocalEffectStyles();
  for (var i = 0; i < styles.length; i++) {
    if (styles[i].name === name) return styles[i];
  }
  return null;
}

function getDefaultFontFromTokens(core) {
  try {
    if (
      core &&
      core.typography &&
      core.typography.fontFamily &&
      core.typography.fontFamily.sans &&
      core.typography.fontFamily.sans.value &&
      core.typography.fontFamily.sans.value.length
    ) {
      return String(core.typography.fontFamily.sans.value[0]);
    }
  } catch (e) {}
  return "Inter";
}

async function loadFontSafe(fontName) {
  try {
    await figma.loadFontAsync({ family: fontName, style: "Regular" });
    return { family: fontName, style: "Regular" };
  } catch (e) {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    return { family: "Inter", style: "Regular" };
  }
}

function titleCaseWord(w) {
  if (!w) return "";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function keyToPrettyTypographyName(key) {
  // examples: "text-sm" -> "Text Sm", "display-2xl" -> "Display 2xl"
  var s = String(key);
  var parts = s.split("-");
  for (var i = 0; i < parts.length; i++) {
    parts[i] = titleCaseWord(parts[i]);
  }
  return parts.join(" ");
}

function parseShadowPart(part) {
  var s = part.trim();
  var re = /^(-?[0-9.]+)px\s+(-?[0-9.]+)px\s+([0-9.]+)px\s+(-?[0-9.]+)px\s+(rgba\([^)]+\))$/i;
  var m = s.match(re);
  if (!m) throw new Error("Bad shadow part: " + part);

  var x = Number(m[1]);
  var y = Number(m[2]);
  var blur = Number(m[3]);
  var spread = Number(m[4]);
  var color = parseRgba01(m[5]);

  return {
    type: "DROP_SHADOW",
    color: color,
    offset: { x: x, y: y },
    radius: blur,
    spread: spread,
    visible: true,
    blendMode: "NORMAL"
  };
}

function parseShadowValue(value) {
  var v = String(value).trim();
  if (v === "none") return [];
  var parts = [];
  var cur = "";
  var depth = 0;
  for (var i = 0; i < v.length; i++) {
    var ch = v[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);

  var effects = [];
  for (var p = 0; p < parts.length; p++) {
    effects.push(parseShadowPart(parts[p]));
  }
  return effects;
}

async function createOrUpdateTextStylesFromTokens(core) {
  if (!core || !core.typography) {
    postLog("ℹ️ No typography block found for styles.");
    return;
  }

  var ff = getDefaultFontFromTokens(core);
  var fontName = await loadFontSafe(ff);

  var fontSizeMap = (core.typography.fontSize && core.typography.fontSize.value) ? core.typography.fontSize.value : null;
  var lineHeightMap = (core.typography.lineHeight && core.typography.lineHeight.value) ? core.typography.lineHeight.value : null;

  if (!fontSizeMap || typeof fontSizeMap !== "object") {
    postLog("ℹ️ typography.fontSize not found for styles.");
    return;
  }

  var created = 0, updated = 0, skipped = 0, failed = 0;

  for (var key in fontSizeMap) {
    if (!isTokenObject(fontSizeMap[key])) continue;

    var fsToken = fontSizeMap[key];
    var fsPx = parsePxNumber(fsToken.value);
    if (fsPx === null || isNaN(fsPx)) { skipped++; continue; }

    var lhPx = null;
    if (lineHeightMap && isTokenObject(lineHeightMap[key])) {
      lhPx = parsePxNumber(lineHeightMap[key].value);
    }

    var pretty = keyToPrettyTypographyName(key);
    var styleName = "Typography/" + pretty;

    try {
      var st = findTextStyleByName(styleName);
      var isNew = false;
      if (!st) { st = figma.createTextStyle(); st.name = styleName; isNew = true; }

      st.fontName = fontName;
      st.fontSize = fsPx;

      if (lhPx !== null && !isNaN(lhPx)) {
        st.lineHeight = { value: lhPx, unit: "PIXELS" };
      }

      if (isNew) created++; else updated++;
    } catch (e) {
      failed++;
      postLog("❌ TextStyle " + styleName + ": " + String(e));
    }
  }

  postLog("🔤 Text styles: created=" + created + " updated=" + updated + " skipped=" + skipped + " failed=" + failed);
}

function createOrUpdateEffectStylesFromTokens(core) {
  if (!core || !core.shadow || !core.shadow.value) {
    postLog("ℹ️ No shadow block found for effect styles.");
    return;
  }

  var shadowMap = core.shadow.value;
  var created = 0, updated = 0, skipped = 0, failed = 0;

  for (var key in shadowMap) {
    if (!isTokenObject(shadowMap[key])) continue;

    var token = shadowMap[key];
    var val = token.value;

    var pretty = titleCaseWord(String(key)); // xs -> Xs, md -> Md, 2xl -> 2xl (keeps leading digit)
    var styleName = "Shadow/" + pretty;

    try {
      var effects = parseShadowValue(val);

      var st = findEffectStyleByName(styleName);
      var isNew = false;
      if (!st) { st = figma.createEffectStyle(); st.name = styleName; isNew = true; }

      st.effects = effects;

      if (isNew) created++; else updated++;
    } catch (e) {
      failed++;
      postLog("❌ EffectStyle " + styleName + ": " + String(e));
    }
  }

  postLog("🪄 Effect styles: created=" + created + " updated=" + updated + " skipped=" + skipped + " failed=" + failed);
}

// ---------- MAIN SYNC ----------

async function syncAllFromJson(json) {
  var core = json["Primitives.Core"] ? json["Primitives.Core"] : json;
  var all = walk(core, []);

  var collection = ensureCollection("Primitives");
  var modeId = ensureMode(collection, "Default");

  var created = 0, updated = 0, failed = 0;

  // COLORS
  var colorCount = 0;
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    var root = e.path[0];

    if ((root === "colors" || root === "color") && e.token.$type === "color") {
      var name = "Colors/" + e.path.slice(1).join("/");
      try {
        var rgba = hexToRgba01(e.token.value);
        var res = upsertColor(collection, modeId, name, rgba);
        if (res === "created") created++; else updated++;
        colorCount++;
      } catch (err) {
        failed++;
        postLog("❌ " + name + ": " + String(err));
      }
    }
  }
  postLog("🎨 Colors synced: " + colorCount);

  // NUMERICS
  var numericRootToPrefix = {
    space: "Space/",
    spacing: "Space/",
    radius: "Radius/",
    borderWidth: "BorderWidth/",
    opacity: "Opacity/",
    zIndex: "ZIndex/"
  };

  function getNumericPrefixFromPath(path) {
    var root = path[0];
    if (numericRootToPrefix[root]) return numericRootToPrefix[root];

    if (root === "typography" && path.length >= 2) {
      var sub = path[1];
      if (sub === "fontSize") return "Typography/fontSize/";
      if (sub === "lineHeight") return "Typography/lineHeight/";
      if (sub === "fontWeight") return "Typography/fontWeight/";
      return null;
    }

    if (root === "fontSize") return "Typography/fontSize/";
    if (root === "lineHeight") return "Typography/lineHeight/";
    if (root === "fontWeight") return "Typography/fontWeight/";

    return null;
  }

  var numericCount = 0;

  for (var k = 0; k < all.length; k++) {
    var e2 = all[k];
    var path = e2.path;
    var prefix = getNumericPrefixFromPath(path);
    if (!prefix) continue;

    var t = e2.token;

    var isDim = t.$type === "dimension";
    var isNum = t.$type === "number";
    var isOpacity = t.$type === "opacity";
    var isFontWeight = t.$type === "fontWeight";

    if (!(isDim || isNum || isOpacity || isFontWeight)) continue;

    var v2 = typeof t.value === "number" ? t.value : parsePxNumber(t.value);
    if (v2 === null || isNaN(v2)) continue;

    var tailStart = 1;
    if (path[0] === "typography") tailStart = 2;

    var varName = prefix + path.slice(tailStart).join("/");

    try {
      var res2 = upsertFloat(collection, modeId, varName, v2);
      if (res2 === "created") created++; else updated++;
      numericCount++;
    } catch (err2) {
      failed++;
      postLog("❌ " + varName + ": " + String(err2));
    }
  }

  postLog("📐 Numerics synced: " + numericCount);

  // STYLES
  try { await createOrUpdateTextStylesFromTokens(core); }
  catch (e) { postLog("❌ Text styles sync error: " + String(e)); }

  try { createOrUpdateEffectStylesFromTokens(core); }
  catch (e2) { postLog("❌ Effect styles sync error: " + String(e2)); }

  postLog("✅ Done. vars created=" + created + " updated=" + updated + " failed=" + failed);
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "close") {
    figma.closePlugin();
    return;
  }

  if (msg.type === "sync") {
    (async function () {
      try {
        postLog("Fetching: " + msg.url);
        var res = await fetch(msg.url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        var json = await res.json();
        await syncAllFromJson(json);
      } catch (e) {
        postLog("❌ Sync error: " + String(e));
      }
    })();
  }
};
