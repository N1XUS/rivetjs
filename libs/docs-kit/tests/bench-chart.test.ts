// Benchmark chart tokens (components/bench-chart.css) against the theme (theme.css), both themes:
// marks (Rivet accent stops, peer bars, whiskers / dots) ≥ 3:1 on the chart surface (WCAG 1.4.11),
// text tokens (labels, ticks, notes) ≥ 4.5:1 (AA).
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const theme = read("../theme.css");
const chart = read("../components/bench-chart.css");

/** `--name: value;` declarations of the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, `no ${selector} block`);
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const tokens = new Map<string, string>();
  for (const m of css.slice(css.indexOf("{", start) + 1, end).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(m[1]!, m[2]!.replace(/\s+/g, " ").trim());
  return tokens;
}

const light = new Map([...block(theme, "@theme"), ...block(theme, ":root"), ...block(chart, ".bench-tokens")]);
const dark = new Map([...light, ...block(theme, '[data-theme="dark"]'), ...block(chart, '[data-theme="dark"] .bench-tokens')]);

/** Resolve `var(--x)` / `var(--x, fallback)` (innermost first). */
function resolve(tokens: Map<string, string>, value: string, depth = 0): string {
  assert.ok(depth < 20, `var() too deep: ${value}`);
  const inner = /var\((--[\w-]+)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/;
  let out = value;
  for (let m = inner.exec(out); m; m = inner.exec(out)) {
    const own = tokens.get(m[1]!);
    const next = own !== undefined ? own : m[2]?.trim();
    assert.ok(next !== undefined, `unknown token ${m[1]}`);
    out = out.slice(0, m.index) + resolve(tokens, next, depth + 1) + out.slice(m.index + m[0].length);
  }
  return out;
}

type RGB = [number, number, number];
const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const clamp = (n: number) => Math.min(1, Math.max(0, n));
function parse(value: string): RGB {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
  }
  const ok = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (ok) {
    const L = Number(ok[1]) / 100;
    const h = (Number(ok[3]) * Math.PI) / 180;
    const a = Number(ok[2]) * Math.cos(h);
    const b = Number(ok[2]) * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ].map((c) => encode(clamp(c))) as RGB;
  }
  throw new Error(`unsupported colour ${value}`);
}
const luminance = ([r, g, b]: RGB) => 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
const color = (tokens: Map<string, string>, name: string) => parse(resolve(tokens, `var(${name})`));

const MARKS = ["--chart-rivet", "--chart-rivet-end", "--chart-peer", "--chart-peer-strong", "--chart-peer-soft"];
const TEXT = ["--chart-label", "--chart-label-strong", "--chart-muted", "--chart-tick"];

for (const [name, tokens] of [
  ["light", light],
  ["dark", dark],
] as const) {
  test(`${name}: chart marks ≥ 3:1 and chart text ≥ 4.5:1 on the chart surface`, () => {
    const surface = color(tokens, "--chart-surface");
    const failures: string[] = [];
    for (const mark of MARKS) if (contrast(color(tokens, mark), surface) < 3) failures.push(`${mark}: ${contrast(color(tokens, mark), surface).toFixed(2)}`);
    for (const text of TEXT) if (contrast(color(tokens, text), surface) < 4.5) failures.push(`${text}: ${contrast(color(tokens, text), surface).toFixed(2)}`);
    assert.deepEqual(failures, []);
  });
  test(`${name}: Rivet stands apart from the peer grey`, () => {
    assert.ok(contrast(color(tokens, "--chart-rivet"), color(tokens, "--chart-peer")) >= 1.3);
  });
}
