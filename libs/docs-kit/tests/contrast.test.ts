// Theme tokens (theme.css): WCAG AA contrast of every text token on every surface it is used on,
// in both themes. Reads the CSS, resolves var() references per theme, computes WCAG 2 contrast.
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";
import { test } from "vitest";
import { AA_COLORS, palette } from "../tools/content/highlight.ts";

const css = readFileSync(new URL("../theme.css", import.meta.url), "utf8");

/** `--name: value;` declarations of the first block that starts with `selector {`. */
function block(selector: string): Map<string, string> {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, `theme.css has no ${selector} block`);
  let depth = 0;
  let end = start;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) {
      end = i;
      break;
    }
  }
  const body = css.slice(css.indexOf("{", start) + 1, end).replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(match[1]!, match[2]!.replace(/\s+/g, " ").trim());
  return tokens;
}

const brand = block("@theme");
const light = new Map([...brand, ...block(":root")]);
const dark = new Map([...light, ...block('[data-theme="dark"]')]);

type RGB = [number, number, number]; // gamma-encoded sRGB 0..1

function resolve(tokens: Map<string, string>, value: string, seen = new Set<string>()): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    assert.ok(!seen.has(name), `cycle at ${name}`);
    const next = tokens.get(name);
    assert.ok(next !== undefined, `unknown token ${name}`);
    return resolve(tokens, next, new Set([...seen, name]));
  });
}

const encode = (linear: number) => (linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055);
const decode = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4));
const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** `#rgb`, `#rrggbb`, `oklch(L% C h)` → sRGB. */
function parse(value: string): RGB {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const h = hex[1]!.length === 3 ? [...hex[1]!].map((c) => c + c).join("") : hex[1]!;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
  }
  const ok = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (ok) {
    const L = Number(ok[1]) / 100;
    const C = Number(ok[2]);
    const h = (Number(ok[3]) * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return lin.map((c) => encode(clamp(c))) as RGB;
  }
  throw new Error(`unsupported colour ${value}`);
}

const color = (tokens: Map<string, string>, name: string): RGB => parse(resolve(tokens, `var(${name})`));
/** `color-mix(in srgb, fg p%, bg)`. */
const mix = (fg: RGB, p: number, bg: RGB): RGB => fg.map((c, i) => c * p + bg[i]! * (1 - p)) as RGB;
const luminance = ([r, g, b]: RGB) => 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ["--fg", "--fg-strong", "--fg-soft", "--fg-faint", "--fg-quiet", "--accent", "--accent-hover", "--accent-strong"];
const SURFACES = ["--bg", "--bg-soft", "--bg-softer", "--bg-code", "--bg-raised"];
/** Callout / code-header accents: label + icon text on their own tint (site.css `--tint` mix over --bg). */
const KINDS = ["--note", "--tip", "--warning", "--gotcha", "--prefer", "--avoid", "--tag-new", "--tag-updated"];
const TINT = { light: 0.07, dark: 0.12 };

for (const [theme, tokens] of [
  ["light", light],
  ["dark", dark],
] as const) {
  test(`${theme}: text tokens ≥ 4.5:1 on every surface`, () => {
    const failures: string[] = [];
    for (const fg of TEXT)
      for (const bg of SURFACES) {
        const ratio = contrast(color(tokens, fg), color(tokens, bg));
        if (ratio < 4.5) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`);
      }
    assert.deepEqual(failures, []);
  });

  test(`${theme}: callout / tag accents ≥ 4.5:1 on their tint and on --bg-soft`, () => {
    const failures: string[] = [];
    const bg = color(tokens, "--bg");
    for (const kind of KINDS) {
      const fg = color(tokens, kind);
      for (const [where, surface] of [
        ["tint", mix(fg, TINT[theme], bg)],
        ["--bg-soft", color(tokens, "--bg-soft")],
      ] as const) {
        const ratio = contrast(fg, surface);
        if (ratio < 4.5) failures.push(`${kind} on ${where}: ${ratio.toFixed(2)}`);
      }
      // Body text inside a callout stays readable on the tint too.
      const body = contrast(color(tokens, "--fg"), mix(fg, TINT[theme], bg));
      if (body < 4.5) failures.push(`--fg on ${kind} tint: ${body.toFixed(2)}`);
    }
    assert.deepEqual(failures, []);
  });

  test(`${theme}: filled buttons: white text ≥ 4.5:1`, () => {
    for (const name of ["--button-bg", "--button-bg-hover"]) {
      const ratio = contrast(color(tokens, name), [1, 1, 1]);
      assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}`);
    }
  });

  test(`${theme}: syntax token colours (generated highlight.css) ≥ 4.5:1 on --bg-code`, () => {
    type Theme = { tokenColors?: { settings?: { foreground?: string; background?: string } }[] };
    const source = (theme === "light" ? githubLight : githubDark) as Theme;
    // Foregrounds drawn on their own background (carriage-return, markup.ignored) are not text on --bg-code.
    const onOwnBackground = new Set(
      (source.tokenColors ?? []).filter((rule) => rule.settings?.background).map((rule) => rule.settings!.foreground!.toLowerCase()),
    );
    const failures: string[] = [];
    for (const original of palette(source)) {
      if (onOwnBackground.has(original)) continue;
      const used = AA_COLORS[theme][original] ?? original;
      const ratio = contrast(parse(used), color(tokens, "--bg-code"));
      if (ratio < 4.5) failures.push(`${original} → ${used}: ${ratio.toFixed(2)}`);
    }
    assert.deepEqual(failures, []);
  });

  test(`${theme}: focus ring and borders are visible (≥ 3:1 for the ring, line-strong ≥ 1.4:1)`, () => {
    const bg = color(tokens, "--bg");
    assert.ok(contrast(color(tokens, "--accent"), bg) >= 3);
    assert.ok(contrast(color(tokens, "--line-strong"), bg) >= 1.4);
  });
}

test("gradients stay soft: indigo → violet only, no full logo spectrum, no gradient text", () => {
  for (const tokens of [light, dark]) {
    for (const name of ["--brand-gradient", "--brand-gradient-vertical"]) {
      const value = resolve(tokens, `var(${name})`).toLowerCase();
      for (const loud of ["#01eef9", "#0360fa", "#f827f5", "#f930bf", "#b815f9"]) assert.ok(!value.includes(loud), `${name} uses ${loud}`);
    }
    for (const name of ["--brand-gradient-text", "--brand-gradient-text-vertical", "--button-gradient"]) assert.ok(!tokens.has(name), `${name} is back`);
  }
});
