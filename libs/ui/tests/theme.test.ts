import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BASE_TOKENS,
  BRUTALIST_PRESET,
  CONTRAST_PAIRS,
  GLASS_PRESET,
  CLASSIC_PRESET,
  MAUVE_PRESET,
  RIVET_PRESET,
  THEME_PRESETS,
  apcaContrast,
  auditContrast,
  CHART_PALETTE,
  chartPalette,
  auditVariables,
  contrastRatio,
  deriveTheme,
  derivedFormulas,
  hexToOklch,
  matchPreset,
  mixOklab,
  oklabToRgb,
  oklchToHex,
  oklchToOklab,
  parseOklch,
  resolveColor,
  resolveParams,
  themeCss,
  themeVariables,
  toStyle,
} from "../src/theme/index.ts";
import { generateThemeFiles, parseVariables } from "../scripts/gen-themes.ts";

const styles = new URL("../styles/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, styles), "utf8");
const vendored = parseVariables(read("themes/default/variables.css"));

// Expected values computed with upstream HeroUI v3.2.6 apps/docs/src/app/[lang]/themes/utils/generate-theme-colors.ts
// (`getColorVariablesForElement(generateThemeColors({ lightness, chroma, hue, grayChroma, semanticOverrides }), mode)`).
const UPSTREAM_SKY_LIGHT = {
  "--background": "oklch(97.02% 0.0015 225.00)",
  "--foreground": "oklch(21.03% 0.0015 225.00)",
  "--accent": "oklch(78.00% 0.1600 225.00)",
  "--accent-foreground": "oklch(15% 0.0300 225.00)",
  "--focus": "oklch(78.00% 0.1600 225.00)",
  "--muted": "oklch(55.17% 0.0030 225.00)",
  "--default": "oklch(94.00% 0.0015 225.00)",
  "--default-foreground": "oklch(21.03% 0.0059 225.00)",
  "--surface": "oklch(100.00% 0.0008 225.00)",
  "--surface-foreground": "oklch(21.03% 0.0015 225.00)",
  "--surface-secondary": "oklch(95.24% 0.0012 225.00)",
  "--surface-secondary-foreground": "oklch(21.03% 0.0015 225.00)",
  "--surface-tertiary": "oklch(93.73% 0.0012 225.00)",
  "--surface-tertiary-foreground": "oklch(21.03% 0.0015 225.00)",
  "--overlay": "oklch(100.00% 0.0004 225.00)",
  "--overlay-foreground": "oklch(21.03% 0.0015 225.00)",
  "--scrollbar": "oklch(87.10% 0.0015 225.00)",
  "--segment": "oklch(100.00% 0.0015 225.00)",
  "--segment-foreground": "oklch(21.03% 0.0015 225.00)",
  "--border": "oklch(90.00% 0.0015 225.00)",
  "--separator": "oklch(92.00% 0.0015 225.00)",
  "--field-background": "oklch(100.00% 0.0008 225.00)",
  "--field-border": "transparent",
  "--field-foreground": "oklch(21.03% 0.0015 225.00)",
  "--field-placeholder": "oklch(55.17% 0.0030 225.00)",
  "--success": "oklch(73.29% 0.1941 147.35)",
  "--success-foreground": "oklch(21.03% 0.0059 147.35)",
  "--warning": "oklch(78.19% 0.1590 68.87)",
  "--warning-foreground": "oklch(21.03% 0.0059 68.87)",
  "--danger": "oklch(65.32% 0.2335 22.28)",
  "--danger-foreground": "oklch(99.11% 0 0)",
};

const NETFLIX_OVERRIDES = {
  light: { danger: { color: "oklch(0.4823 0.1938 27.64)" }, success: { color: "oklch(0.5148 0.1337 146.82)" } },
  dark: { warning: { color: "oklch(0.8239 0.153 74.6)" } },
};
const UPSTREAM_NETFLIX_DARK = {
  "--background": "oklch(12.00% 0.0000 27.99)",
  "--foreground": "oklch(99.11% 0.0000 27.99)",
  "--accent": "oklch(58.14% 0.2349 27.99)",
  "--accent-foreground": "oklch(99.11% 0 0)",
  "--focus": "oklch(58.14% 0.2349 27.99)",
  "--muted": "oklch(70.50% 0.0000 27.99)",
  "--default": "oklch(27.40% 0.0000 27.99)",
  "--default-foreground": "oklch(99.11% 0 0)",
  "--surface": "oklch(21.03% 0.0000 27.99)",
  "--surface-foreground": "oklch(99.11% 0.0000 27.99)",
  "--surface-secondary": "oklch(25.70% 0.0000 27.99)",
  "--surface-secondary-foreground": "oklch(99.11% 0.0000 27.99)",
  "--surface-tertiary": "oklch(27.21% 0.0000 27.99)",
  "--surface-tertiary-foreground": "oklch(99.11% 0.0000 27.99)",
  "--overlay": "oklch(21.03% 0.0000 27.99)",
  "--overlay-foreground": "oklch(99.11% 0.0000 27.99)",
  "--scrollbar": "oklch(70.50% 0.0000 27.99)",
  "--segment": "oklch(39.64% 0.0000 27.99)",
  "--segment-foreground": "oklch(99.11% 0.0000 27.99)",
  "--border": "oklch(28.00% 0.0000 27.99)",
  "--separator": "oklch(25.00% 0.0000 27.99)",
  "--field-background": "oklch(21.03% 0.0000 27.99)",
  "--field-border": "transparent",
  "--field-foreground": "oklch(99.11% 0.0000 27.99)",
  "--field-placeholder": "oklch(70.50% 0.0000 27.99)",
  "--success": "oklch(73.29% 0.1935 123.71)",
  "--success-foreground": "oklch(15% 0.0500 123.71)",
  "--warning": "oklch(0.8239 0.153 74.6)",
  "--warning-foreground": "oklch(15% 0.0459 74.60)",
  "--danger": "oklch(59.40% 0.1967 357.53)",
  "--danger-foreground": "oklch(98% 0.0197 357.53)",
};

test("theme: deriveTheme = upstream theme builder output (sky light, netflix dark with semantic overrides)", () => {
  assert.deepEqual(deriveTheme({ lightness: 0.78, chroma: 0.16, hue: 225, base: 0.0015 }).light, UPSTREAM_SKY_LIGHT);
  assert.deepEqual(deriveTheme({ lightness: 0.5814, chroma: 0.2349, hue: 27.99, base: 0, semanticOverrides: NETFLIX_OVERRIDES }).dark, UPSTREAM_NETFLIX_DARK);
  // Every authored token, in upstream output order.
  assert.deepEqual(Object.keys(deriveTheme(RIVET_PRESET).light).sort(), [...BASE_TOKENS].sort());
});

test("theme: Classic accent (CLASSIC_PRESET) with gray chroma 0 reproduces the vendored default theme's colours", () => {
  const near = (a: string, b: string, name: string) => {
    const x = parseOklch(a)!;
    const y = parseOklch(b.replace(/^var\(--snow\)$/, "oklch(0.9911 0 0)").replace(/^var\(--eclipse\)$/, "oklch(0.2103 0.0059 285.89)"))!;
    assert.ok(x && y, `${name}: ${a} / ${b}`);
    assert.ok(Math.abs(x.l - y.l) < 1e-3 && Math.abs(x.c - y.c) < 1e-3 && (x.c < 1e-3 || Math.abs(x.h - y.h) < 0.01), `${name}: ${a} vs ${b}`);
  };
  const t = deriveTheme({ ...CLASSIC_PRESET, base: 0 });
  const common = new Map(vendored.common);
  near(t.light["--accent"], common.get("--accent")!, "--accent");
  near(t.light["--success"], common.get("--success")!, "--success");
  for (const [mode, decls] of [
    ["light", vendored.light],
    ["dark", vendored.dark],
  ] as const) {
    const v = new Map(decls);
    for (const name of ["--warning", "--danger", "--danger-foreground"]) near(t[mode][name as "--danger"], v.get(name)!, `${mode} ${name}`);
  }
});

test("theme: derivedFormulas = the vendored variables.css formulas (light, dark, vibrant)", () => {
  for (const [mode, decls] of [
    ["light", vendored.light],
    ["dark", vendored.dark],
  ] as const) {
    const v = new Map(decls);
    for (const [name, formula] of Object.entries(derivedFormulas(mode))) if (name !== "--tw-ring-color") assert.equal(formula, v.get(name), `${mode} ${name}`);
  }
  // Upstream builder writes `var(accent)` here (its "--VAR" placeholder replace drops the dashes); the port emits the
  // stylesheet's own `[data-vibrant-palette]` formulas.
  const vibrant = read("themes/default/variables.css");
  for (const [name, formula] of Object.entries(derivedFormulas("light", { vibrant: true })))
    if (name.endsWith("-soft-foreground") && name !== "--default-soft-foreground") assert.ok(vibrant.includes(`${name}: ${formula};`), name);
});

test("theme: Rivet theme passes WCAG AA + APCA (text 4.5:1 / Lc 60, focus / accent / chart series 3:1 / Lc 30) in light and dark", () => {
  for (const mode of ["light", "dark"] as const) {
    const fails = auditContrast(RIVET_PRESET, mode).filter((r) => !r.pass);
    assert.deepEqual(
      fails.map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} / Lc ${r.apca.toFixed(1)}`),
      [],
      mode,
    );
  }
});

test("theme: the shipped rivet.css passes the same audit (resolved against the vendored formulas)", () => {
  const rivet = read("themes/rivet.css");
  const block = (start: string) => {
    const i = rivet.indexOf(start);
    const body = rivet.slice(rivet.indexOf("{", i) + 1, rivet.indexOf("}", i));
    return [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()] as [string, string]);
  };
  const light = { ...Object.fromEntries(vendored.common), ...Object.fromEntries(vendored.light), ...Object.fromEntries(block(":root,\n  .light")) };
  const dark = { ...light, ...Object.fromEntries(vendored.dark), ...Object.fromEntries(block(".dark,")) };
  for (const [mode, vars] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    const fails = auditVariables(vars, mode).filter((r) => !r.pass);
    assert.deepEqual(
      fails.map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)}`),
      [],
      mode,
    );
  }
  // The Classic (upstream default) theme misses AA on white-on-accent (3.6:1): the reason the Rivet accent is deeper.
  assert.ok(auditContrast(CLASSIC_PRESET, "light").some((r) => r.fg === "--accent-foreground" && !r.pass));
  assert.equal(CONTRAST_PAIRS.length, 35);
  // The chart palette the audit uses is the one the theme ships (theme tokens, not `.chart`-only: Widget legends read
  // `var(--chart-N)` outside a chart), light + dark blocks, `--chart-1` = the accent.
  const theme = read("themes/rivet.css");
  const darkAt = theme.indexOf("  .dark,");
  for (const [mode, block] of [
    ["light", theme.slice(0, darkAt)],
    ["dark", theme.slice(darkAt)],
  ] as const)
    for (const [name, value] of Object.entries(chartPalette(mode))) assert.ok(block.includes(`${name}: ${value};`), `${mode} ${name}`);
  assert.doesNotMatch(read("components/chart.css"), /--chart-[1-6]:/);
  assert.equal(themeVariables(RIVET_PRESET, "dark")["--chart-4"], CHART_PALETTE.dark["--chart-4"]);
  assert.equal(themeVariables(RIVET_PRESET, "light")["--chart-1"], "var(--accent)");
});

test("theme: generated stylesheets are current; entries wire the themes", () => {
  for (const [path, content] of Object.entries(generateThemeFiles())) assert.equal(read(path), content, `${path} is stale: node libs/ui/scripts/gen-themes.ts`);
  const index = read("index.css");
  assert.match(index, /@import "\.\/themes\/rivet\.css" layer\(theme\);/);
  assert.doesNotMatch(index, /themes\/default\/index\.css/);
  // One shipped theme (spec 2026-10-11 §1.1): the upstream look is a preset (`CLASSIC_PRESET`), not an entry.
  assert.throws(() => read("heroui.css"));
  assert.throws(() => read("themes/heroui.css"));
  const rivet = read("themes/rivet.css");
  assert.match(rivet, /^\/\* Generated by .* Do not edit\. \*\//);
  assert.match(rivet, /@import "\.\/default\/index\.css";/);
  assert.match(rivet, /--accent: oklch\(52\.00% 0\.2400 264\.00\);/);
  assert.match(rivet, /--rivet-gradient: linear-gradient\(/);
  const scoped = read("themes/scoped.css");
  assert.ok(scoped.includes(`[data-ui-theme="rivet"] {`));
  assert.ok(scoped.includes(`[data-theme="dark"] [data-ui-theme="rivet"]`));
  assert.doesNotMatch(scoped, /data-ui-theme="heroui"/);
  assert.match(scoped, /--accent-hover: color-mix/);
});

test("theme: look presets (brutalist / glass / mauve) pass the same audit; glass also composited on the background", () => {
  // Glass surfaces / fields are translucent: also audit them painted over the page background (the stage behind them).
  const onBackground = CONTRAST_PAIRS.map((p) => (!p.on && (p.bg === "--surface" || p.bg === "--field-background") ? { ...p, on: "--background" } : p));
  for (const preset of [BRUTALIST_PRESET, GLASS_PRESET, MAUVE_PRESET])
    for (const mode of ["light", "dark"] as const)
      for (const pairs of preset === GLASS_PRESET ? [CONTRAST_PAIRS, onBackground] : [CONTRAST_PAIRS]) {
        const fails = auditContrast(resolveParams(preset), mode, undefined, pairs).filter((r) => !r.pass);
        assert.deepEqual(
          fails.map((r) => `${r.fg} on ${r.bg}: ${r.ratio.toFixed(2)} / Lc ${r.apca.toFixed(1)}`),
          [],
          `${preset.id} ${mode}`,
        );
      }
  // Shape tokens are real theme output (themeCss / themeVariables), not inline styles.
  assert.equal(themeVariables(resolveParams(BRUTALIST_PRESET), "light")["--border-width"], "2px");
  assert.equal(themeVariables(resolveParams(GLASS_PRESET), "dark")["--surface-backdrop"], "blur(20px) saturate(1.4)");
  assert.match(themeCss(resolveParams(BRUTALIST_PRESET)), /--surface-shadow: inset 0 0 0 2px var\(--foreground\), 4px 4px 0 0 var\(--foreground\);/);
  assert.equal(matchPreset({ ...GLASS_PRESET, overrides: undefined, semanticOverrides: undefined })?.id, "glass");
});

test("theme: presets.css scopes every preset to [data-ui-preset] with the shape tokens reset", () => {
  const css = read("themes/presets.css");
  assert.match(css, /^\/\* Generated by .* Do not edit\. \*\//);
  for (const p of THEME_PRESETS) {
    assert.ok(css.includes(`[data-ui-preset="${p.id}"] {`), p.id);
    assert.ok(css.includes(`[data-theme="dark"] [data-ui-preset="${p.id}"]`), p.id);
  }
  const block = (id: string) => css.slice(css.indexOf(`[data-ui-preset="${id}"] {`)).split("}")[0]!;
  for (const name of ["--border-width", "--field-border-width", "--surface-shadow", "--overlay-shadow", "--field-shadow", "--surface-backdrop"])
    for (const p of THEME_PRESETS) assert.ok(block(p.id).includes(`${name}:`), `${p.id} ${name}`);
  assert.match(block("rivet"), /--surface-backdrop: none;/);
  assert.match(block("brutalist"), /--border-width: 2px;/);
  assert.match(block("glass"), /--surface-backdrop: blur\(20px\) saturate\(1\.6\);/);
});

test("theme: themeVariables / themeCss / toStyle", () => {
  const vars = themeVariables(RIVET_PRESET, "dark");
  assert.equal(vars["--radius"], "0.5rem");
  assert.equal(vars["--field-radius"], "0.75rem");
  assert.equal(vars["--radius-xl"], "calc(var(--radius) * 1.5)");
  assert.equal(vars["--accent-soft"], "color-mix(in oklab, var(--accent) 12%, transparent)");
  assert.equal(vars["--background"], "oklch(12.00% 0.0050 264.00)");
  assert.match(toStyle({ "--a": "1", "--b": "x" }), /^--a: 1; --b: x;$/);
  const css = themeCss({ ...CLASSIC_PRESET, radius: "small", formRadius: "none" });
  assert.match(css, /^\/\*\n \* Rivet UI theme/);
  assert.match(css, /:root,\n\.light,\n\.default,\n\[data-theme="light"\],\n\[data-theme="default"\] \{/);
  assert.match(css, /  --accent: oklch\(62\.04% 0\.1950 253\.83\);/);
  assert.match(css, /  --radius: 0\.25rem;\n  --field-radius: 0;/);
  assert.match(css, /\.dark,\n\[data-theme="dark"\] \{\n  color-scheme: dark;/);
  assert.doesNotMatch(css, /:host/);
  assert.match(themeCss({ ...CLASSIC_PRESET, vibrant: true }), /data-vibrant-palette="true"/);
});

test("theme: presets, matchPreset, adaptive black accent", () => {
  assert.equal(THEME_PRESETS[0], RIVET_PRESET);
  assert.equal(new Set(THEME_PRESETS.map((p) => p.id)).size, THEME_PRESETS.length);
  assert.equal(matchPreset({ lightness: 0.6204, chroma: 0.195, hue: 253.83 })?.id, "classic");
  assert.equal(matchPreset({ lightness: 0.6204, chroma: 0.195, hue: 253.83, radius: "small" }), undefined);
  assert.equal(matchPreset({ ...RIVET_PRESET, semanticOverrides: undefined })?.id, "rivet");
  const resolved = resolveParams({ ...RIVET_PRESET, semanticOverrides: undefined, overrides: undefined });
  assert.deepEqual(resolved.semanticOverrides, RIVET_PRESET.semanticOverrides);
  assert.deepEqual(resolved.overrides, RIVET_PRESET.overrides);
  assert.ok(auditContrast(resolved, "light").every((r) => r.pass));
  const mono = deriveTheme(resolveParams(THEME_PRESETS.find((p) => p.id === "mono")!));
  assert.equal(mono.light["--accent"], "oklch(0 0 0)");
  assert.equal(mono.dark["--accent"], "oklch(0.9848 0 0)");
  assert.equal(mono.light["--accent-foreground"], "oklch(99.11% 0 0)");
  assert.equal(mono.dark["--accent-foreground"], "oklch(15% 0.0000 0.00)");
  assert.equal(
    themeVariables(
      THEME_PRESETS.find((p) => p.id === "mono")!,
      "dark",
    )["--accent-soft-foreground"],
    "oklch(0.9848 0 0)",
  );
});

test("theme: colour math (OKLCH ↔ sRGB, color-mix, contrast)", () => {
  const blue = hexToOklch("#0360fa");
  assert.ok(Math.abs(blue.l - 0.5482) < 1e-3 && Math.abs(blue.c - 0.2414) < 1e-3 && Math.abs(blue.h - 261.45) < 0.05);
  assert.equal(oklchToHex(blue), "#0360fa");
  assert.equal(oklchToHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(contrastRatio(oklabToRgb(oklchToOklab({ l: 1, c: 0, h: 0 })), oklabToRgb(oklchToOklab({ l: 0, c: 0, h: 0 }))).toFixed(2), "21.00");
  // Sum below 100 % scales alpha; mixing with transparent keeps the colour (premultiplied).
  const red = oklchToOklab({ l: 0.6, c: 0.2, h: 25 });
  const soft = mixOklab(red, 15, { l: 0, a: 0, b: 0, alpha: 0 }, undefined);
  assert.ok(Math.abs(soft.alpha! - 0.15) < 1e-9 && Math.abs(soft.l - 0.6) < 1e-9);
  const hover = mixOklab(red, 90, { l: 1, a: 0, b: 0 }, 2);
  assert.ok(Math.abs(hover.alpha! - 0.92) < 1e-9);
  assert.equal(resolveColor({ "--x": "oklch(0.5 0 0)" }, "var(--y, var(--x))").l, 0.5);
  assert.deepEqual(parseOklch("oklch(62.04% 0.195 253.83 / 50%)"), { l: 0.6204, c: 0.195, h: 253.83, alpha: 0.5 });
  assert.equal(parseOklch("var(--snow)"), null);
  // APCA-W3 0.1.9 reference values (apca-w3 README: APCAcontrast(sRGBtoY(text), sRGBtoY(background))).
  const hex = (h: string) => ({ r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255, alpha: 1 });
  assert.equal(apcaContrast(hex("888888"), hex("ffffff")).toFixed(4), "63.0565");
  assert.equal(apcaContrast(hex("ffffff"), hex("888888")).toFixed(4), "-68.5415");
  assert.equal(apcaContrast(hex("000000"), hex("aaaaaa")).toFixed(4), "58.1463");
  assert.equal(apcaContrast(hex("112233"), hex("ddeeff")).toFixed(4), "91.6683");
  assert.equal(apcaContrast(hex("ffffff"), hex("000000")).toFixed(4), "-107.8847");
  assert.equal(apcaContrast(hex("777777"), hex("777777")), 0);
});

test("theme: motion.overlays sets the cdk motion token (spring overlays); unset adds nothing", () => {
  assert.equal(themeVariables(RIVET_PRESET, "light")["--rv-motion-spring"], undefined);
  assert.doesNotMatch(themeCss(RIVET_PRESET), /--rv-motion-spring/);
  assert.equal(themeVariables({ ...RIVET_PRESET, motion: { overlays: "spring" } }, "dark")["--rv-motion-spring"], "0.3 0.2");
  assert.equal(themeVariables({ ...RIVET_PRESET, motion: { overlays: "0.5 0" } }, "light")["--rv-motion-spring"], "0.5 0");
  assert.match(themeCss({ ...RIVET_PRESET, motion: { overlays: "spring" } }), /--rv-motion-spring: 0\.3 0\.2;/);
});
