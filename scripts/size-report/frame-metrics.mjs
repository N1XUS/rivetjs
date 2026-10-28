// Frame payload metrics (ZERO Z2, 2026-10-25; measureFrame shape from codex 6ce43445b): what one prerendered docs
// frame page ships — HTML, hole markers, the boundaries tail (records / state bytes), inline JS, and the external JS
// it fetches before input (script `src`, modulepreload, `data-rt`, `data-fo`, tail chunk URLs; each unique file once,
// compressed per file as served). Pure functions over HTML + an asset map: `frames.mjs` runs them on a frames-only
// docs build, `tests/frame-payload.test.ts` on literals.
import { brotliCompressSync, gzipSync, constants } from "node:zlib";

/** Ratcheted fields: any growth over the committed ceiling fails `frames.mjs --check`. */
export const FIELDS = ["html", "holes", "records", "stateBytes", "inlineJsBytes", "files", "jsRaw", "jsBr"];
const EXECUTABLE = new Set(["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"]);

/** Script tags of a page (bodies are raw text in HTML). */
export function frameScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((match) => {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)].map((attr) => [
        attr[1].toLowerCase(),
        attr[2] ?? attr[3] ?? attr[4] ?? "",
      ]),
    );
    return { attributes, body: match[2] };
  });
}

/** Records of a boundaries tail, v1 (`b` = records) or v2 (`b` = records + runs `[id, 0, 0, -1, count, tmpl]`). */
export function tailRecords(tail) {
  if (!Array.isArray(tail?.b)) throw new Error("frame payload: missing boundaries array");
  return tail.b.reduce((n, e) => n + (tail.v === 2 && e[3] === -1 ? e[4] * e[5].length : 1), 0);
}

/** Chunk URLs a tail names: v1 `m` (name → URL), v2 `u` (URL table; short entries resolve against `data-ab`). */
function tailUrls(tail, full) {
  return tail.v === 2 ? (tail.u ?? []).map(full) : Object.values(tail.m ?? {});
}

/**
 * One frame: `assets` maps a URL path (`/assets/x.js`) to its bytes. Inline executable JS and data-script bodies
 * (tail, JSON) are UTF-8 byte counts, not part of `jsRaw` / `jsBr`. A referenced asset missing from `assets` throws.
 */
export function measureFrame(html, assets) {
  const urls = new Set();
  let inlineJsBytes = 0,
    stateBytes = 0,
    records = 0;
  for (const { attributes: attrs, body } of frameScripts(html)) {
    const ab = attrs["data-ab"];
    const full = (u) => (ab && !u.includes("/") ? ab + u + ".js" : u);
    for (const url of [attrs.src, attrs["data-rt"], ...(attrs["data-fo"] ?? "").split(/\s+/)]) if (url) urls.add(full(url));
    const type = (attrs.type ?? "").trim().toLowerCase();
    if (EXECUTABLE.has(type)) {
      if (!attrs.src) inlineJsBytes += Buffer.byteLength(body);
    } else {
      stateBytes += Buffer.byteLength(body);
      if (type === "rivet/boundaries") {
        const tail = JSON.parse(body.replace(/\\u003c/g, "<"));
        records += tailRecords(tail);
        for (const url of tailUrls(tail, full)) urls.add(url);
      }
    }
  }
  for (const m of html.matchAll(/<link\b[^>]*\brel="modulepreload"[^>]*>/g)) {
    const href = /\bhref="([^"]+)"/.exec(m[0])?.[1];
    if (href) urls.add(href);
  }
  let jsRaw = 0,
    jsGz = 0,
    jsBr = 0;
  for (const url of urls) {
    const asset = assets.get(url.split("?")[0]);
    if (!asset) throw new Error(`frame payload: missing asset ${url}`);
    jsRaw += asset.byteLength;
    jsGz += gzipSync(asset, { level: 9 }).byteLength;
    jsBr += brotliCompressSync(asset, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).byteLength;
  }
  return {
    html: Buffer.byteLength(html),
    holes: (html.match(/<!--\[-->/g) ?? []).length,
    records,
    stateBytes,
    inlineJsBytes,
    files: urls.size,
    jsRaw,
    jsGz,
    jsBr,
    urls: [...urls].sort(),
  };
}

/**
 * Committed measurements are ceilings: reductions pass, growth of a `FIELDS` value beyond `tolerance` bytes (counts:
 * exact) fails; a frame missing on either side fails. Returns the improvements (for the `--update` hint).
 */
export function assertFrameCeilings(measured, ceilings, { tolerance = 0 } = {}) {
  const failures = [],
    better = [];
  for (const id of new Set([...Object.keys(measured), ...Object.keys(ceilings)])) {
    if (!measured[id] || !ceilings[id]) {
      failures.push(`${id}: missing ${measured[id] ? "baseline" : "measurement"}`);
      continue;
    }
    for (const field of FIELDS) {
      const actual = measured[id][field],
        limit = ceilings[id][field];
      if (!Number.isSafeInteger(actual) || actual < 0 || !Number.isSafeInteger(limit) || limit < 0)
        failures.push(`${id}: invalid ${field} measurement/ceiling`);
      else if (actual > limit + (["holes", "records", "files"].includes(field) ? 0 : tolerance))
        failures.push(`${id}: ${field} ${actual} exceeds ceiling ${limit} (+${actual - limit})`);
      else if (actual < limit) better.push(`${id}: ${field} ${limit} -> ${actual}`);
    }
  }
  if (failures.length) throw new Error(`frame payload regressions:\n${failures.join("\n")}`);
  return better;
}

/** Distance to a stated target (ZERO acceptance): `{ id: { jsGz: limit } }` → rows over target (informational). */
/**
 * Targets that gate (2026-10-26 rule: a ZERO target becomes a gate once met): the fields of `targets` the committed
 * baseline (`frames.json`) already meets. A frame or field without a baseline value stays informational.
 */
export function metTargets(baseline, targets) {
  const met = {};
  for (const [id, target] of Object.entries(targets))
    for (const [field, limit] of Object.entries(target))
      if (baseline[id] && Number.isSafeInteger(baseline[id][field]) && baseline[id][field] <= limit) (met[id] ??= {})[field] = limit;
  return met;
}

/** Split `overTargets(measured, targets)` into regressions of met targets (`gating`) and the remaining gap (`open`). */
export function targetGaps(measured, targets, baseline) {
  const met = metTargets(baseline, targets);
  const gating = overTargets(measured, met);
  const open = overTargets(measured, targets).filter((row) => !gating.includes(row));
  return { met, gating, open };
}

export function overTargets(measured, targets) {
  const rows = [];
  for (const [id, target] of Object.entries(targets))
    for (const [field, limit] of Object.entries(target))
      if (measured[id] && measured[id][field] > limit) rows.push(`${id}: ${field} ${measured[id][field]} > target ${limit}`);
  return rows;
}
