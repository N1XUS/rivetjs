// Motion tokens (identity spec 2026-10-11 §3.6, TWEAKS.md TW-141 / TW-146 / TW-186..188, MOTION-HARMONY 2026-10-29): every
// transition / animation in the component stylesheets (`styles/components/*.css`) takes its duration AND easing from a motion
// ROLE token (state / move / collapse / indicator / enter-exit `--motion-*`, popup `--popup-*`, overlay `--overlay-*`, the
// component variables built on them: `--toast-*`, `--action-bar-*`, …, morph icons `--*-morph-*`) or a listed exception with
// its reason. Primitives (`--duration-fast | base | slow`, `--ease-smooth | out-quad | …`) live in the theme only; a literal
// duration or curve fails; Tailwind defaults (a `transition*` / `animate-in` utility without `duration-(…)` + `ease-(…)`)
// fail; a role's duration paired with another role's easing fails; same-role components must use the same tokens. An
// exception that no longer occurs fails too (stale).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../styles/components/", import.meta.url);
const theme = readFileSync(new URL("../styles/themes/shared/theme.css", import.meta.url), "utf8");

/** Literal durations kept (file → literals), by reason. */
const EXCEPTIONS: { reason: string; uses: Record<string, string[]> }[] = [
  { reason: "0 ms: an instant visibility / delay switch, not a motion", uses: { "calendar-year-picker": ["0ms"], sidebar: ["0ms"] } },
  { reason: "stagger delays (year cells fade after the grid, checkmark draw after the fill)", uses: { "calendar-year-picker": ["50ms"], checkbox: ["15ms"] } },
  {
    reason: "autofill background hold (`9999s` keeps the browser's autofill colour from painting)",
    uses: { "input-group": ["9999s", "0s"], "number-field": ["9999s", "0s"], "search-field": ["9999s", "0s"] },
  },
  {
    reason: "looping indicators (spinners, shimmer, pulse, bounce): a period, not a transition",
    uses: {
      "chain-of-thought": ["1s"],
      "chat-loader": ["1.2s", "0.15s", "0.3s", "1.4s"],
      "chat-tool": ["1s"],
      "progress-circle": ["1s"],
      markdown: ["1.1s"],
      "prompt-input": ["1s"],
      "progress-bar": ["1.5s"],
      "text-shimmer": ["2.2s"],
      status: ["1.6s"],
      "qr-code": ["1.6s", "3.2s"],
    },
  },
  { reason: "MASONRY lane owns masonry.css (bento item hover; to migrate to the state role there)", uses: { masonry: ["150ms"] } },
  {
    reason:
      "documented duration props (PressableFeedback `duration` / `releaseDuration` defaults: CSS fallbacks of the variables the props write; M3 ripple fade); 1 ms = reduced-motion end state",
    uses: { "pressable-feedback": ["150ms", "375ms", "1ms", "200ms", "2000ms", "300ms"] },
  },
  {
    reason:
      "pointer-tracked tilt: an 80 ms follow while the pointer moves, a slow 400–500 ms settle / glare fade on leave (physical feel, longer than --duration-slow)",
    uses: { "holo-card": ["500ms", "80ms", "400ms"] },
  },
];

const LITERAL = /(?<![\w.-])(\d+(?:\.\d+)?m?s)\b|(?<![\w-])duration-(\d+)(?![\w.])/g;

function literals(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "index.css")) {
    const name = file.slice(0, -4);
    const css = readFileSync(new URL(file, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(LITERAL)) {
      const value = m[1] ?? `duration-${m[2]}`;
      (found.get(name) ?? found.set(name, new Set()).get(name)!).add(value);
    }
  }
  return found;
}

test("theme declares the motion tokens and the standard easing", () => {
  assert.match(theme, /--duration-fast: 120ms;/);
  assert.match(theme, /--duration-base: 180ms;/);
  assert.match(theme, /--duration-slow: 260ms;/);
  assert.match(theme, /--ease-smooth: cubic-bezier\(0\.2, 0, 0, 1\);/);
  // Overlay motion (TW-146): Sheet's iOS sheet timing, shared by Drawer / Sheet / Modal.
  assert.match(theme, /--overlay-ease: cubic-bezier\(0\.32, 0\.72, 0, 1\);/);
  assert.match(theme, /--overlay-duration: 500ms;/);
  assert.match(theme, /--overlay-fade-duration: 400ms;/);
  assert.match(theme, /--overlay-exit-duration: var\(--duration-slow\);/);
});

/** Overlay panels (role "overlay", TW-146 / TW-186): enter, backdrop fade and exit only from the overlay tokens. */
const OVERLAYS: Record<string, RegExp> = {
  drawer: /[\s\S]*/,
  sheet: /[\s\S]*/,
  modal: /[\s\S]*/,
  "alert-dialog": /[\s\S]*/,
  command: /[\s\S]*/,
  // Sidebar mobile sheet = a Drawer on the same side; navbar mobile menu; Lightbox (backdrop fade).
  sidebar: /\.sidebar__sheet[\s\S]*/,
  navbar: /\.navbar__menu \{[\s\S]*?\n\}/,
  lightbox: /\.lightbox__backdrop \{[\s\S]*?\n\}/,
};

test("overlay panels (Drawer / Sheet / Modal / AlertDialog / Command / sidebar sheet / navbar menu / Lightbox) take their timing from the overlay tokens only", () => {
  for (const [name, part] of Object.entries(OVERLAYS)) {
    const css = readFileSync(new URL(`${name}.css`, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const block = css.match(part)?.[0] ?? "";
    assert.ok(block, `${name}: overlay rules not found`);
    assert.doesNotMatch(block, /cubic-bezier\(0\.32/, `${name}: literal sheet curve`);
    if (part.source !== "[\\s\\S]*")
      assert.doesNotMatch(block, /cubic-bezier|--duration-(fast|base|slow)|--ease-/, `${name}: primitive / literal timing in an overlay part`);
    assert.match(block, /--overlay-(duration|fade-duration)/, `${name}: enter`);
    assert.match(block, /--overlay-exit-duration/, `${name}: exit`);
    assert.match(block, /--overlay-ease/, `${name}: curve`);
  }
});

test("every duration in component CSS is a motion token or a listed exception", () => {
  const allowed = new Map<string, Set<string>>();
  for (const { uses } of EXCEPTIONS)
    for (const [file, list] of Object.entries(uses)) for (const u of list) (allowed.get(file) ?? allowed.set(file, new Set()).get(file)!).add(u);
  const found = literals();
  const unlisted = [...found].flatMap(([file, set]) => [...set].filter((u) => !allowed.get(file)?.has(u)).map((u) => `${file}.css ${u}`));
  assert.deepEqual(unlisted, [], "literal duration: use var(--duration-fast | base | slow) / duration-(--duration-*) or list it with a reason");
  const stale = [...allowed].flatMap(([file, set]) => [...set].filter((u) => !found.get(file)?.has(u)).map((u) => `${file}.css ${u}`));
  assert.deepEqual(stale, [], "exception no longer occurs: remove it");
});

test("theme declares the motion role tokens on the primitives", () => {
  for (const [token, value] of [
    ["--motion-state-duration", "var(--duration-fast)"],
    ["--motion-state-ease", "var(--ease-smooth)"],
    ["--motion-move-duration", "var(--duration-base)"],
    ["--motion-move-ease", "var(--ease-smooth)"],
    ["--motion-collapse-duration", "var(--duration-base)"],
    ["--motion-collapse-ease", "var(--ease-out-quad)"],
    ["--motion-indicator-duration", "var(--duration-base)"],
    ["--motion-indicator-ease", "var(--ease-out-fluid)"],
    ["--motion-enter-duration", "var(--duration-slow)"],
    ["--motion-exit-duration", "var(--duration-base)"],
    ["--motion-enter-ease", "var(--ease-out-fluid)"],
    ["--popup-duration", "var(--duration-fast)"],
    ["--popup-exit-duration", "var(--duration-fast)"],
    ["--popup-ease", "var(--ease-smooth)"],
  ])
    assert.ok(theme.includes(`${token}: ${value};`), `${token}: ${value}`);
});

/** Primitive / literal timing kept in component CSS (file → exact matches), by reason. Everything else uses role tokens. */
const PRIMITIVE_EXCEPTIONS: { reason: string; uses: Record<string, string[]> }[] = [
  {
    reason: "checkmark / check draws: a linear stroke reveal (the fill animates on the role tokens around it)",
    uses: {
      checkbox: ["var(--duration-fast) linear", "var(--duration-fast) var(--ease-linear)", "var(--duration-base) var(--ease-linear)"],
      "list-box-item": ["var(--duration-base) linear"],
      "menu-item": ["var(--duration-fast) linear"],
      stepper: ["var(--duration-slow) var(--ease-out", "ease-out"],
    },
  },
  { reason: "0 ms visibility switches (instant, not a motion)", uses: { "calendar-year-picker": ["0ms linear"] } },
  { reason: "autofill background hold", uses: { "input-group": ["ease-in-out"], "number-field": ["ease-in-out"], "search-field": ["ease-in-out"] } },
  {
    reason: "looping indicators: a period + its curve, not a transition",
    uses: {
      "chain-of-thought": ["1s linear"],
      "chat-loader": ["var(--ease-in-out", "ease-in-out"],
      "chat-tool": ["1s linear"],
      "progress-circle": ["1s linear"],
      "prompt-input": ["1s linear"],
      "progress-bar": ["cubic-bezier"],
      "qr-code": ["1.6s linear", "ease-in-out"],
      status: ["cubic-bezier"],
      markdown: ["var(--ease-out", "ease-out"],
    },
  },
  { reason: "MASONRY lane owns masonry.css", uses: { masonry: ["var(--ease-out", "ease-out"] } },
  {
    reason: "PressableFeedback duration props (M3 ripple / hold-confirm curves; documented defaults)",
    uses: { "pressable-feedback": ["var(--duration-fast) linear", "cubic-bezier", "375ms linear", "2000ms) linear", "var(--ease-out"] },
  },
  { reason: "pointer-tracked HoloCard tilt / glare (physical settle, own curve)", uses: { "holo-card": ["var(--ease-out"] } },
];

// Primitive durations, primitive / keyword easings and literal curves (CSS values and Tailwind utilities).
const PRIMITIVE =
  /var\(--duration-(?:fast|base|slow)\)(?: (?:linear|var\(--ease-[\w-]+))?|duration-\(--duration-(?:fast|base|slow)\)|var\(--ease-(?:smooth|out|in|in-out|linear|out-quad|out-quart|out-fluid)\b|(?<![\w(-])ease-(?:out|in|in-out|linear|smooth|out-quad|out-quart|out-fluid)(?![\w-])|cubic-bezier|\d+(?:\.\d+)?m?s\)? linear\b/g;

function cssOf(file: string): string {
  return readFileSync(new URL(file, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}
const files = (): string[] => readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "index.css");

test("component CSS has no primitive or literal timing outside listed exceptions (role tokens only)", () => {
  const allowed = new Map<string, string[]>();
  for (const { uses } of PRIMITIVE_EXCEPTIONS) for (const [file, list] of Object.entries(uses)) allowed.set(file, [...(allowed.get(file) ?? []), ...list]);
  const unlisted: string[] = [];
  const used = new Set<string>();
  for (const file of files()) {
    const name = file.slice(0, -4);
    // Keyframe bodies hold no timing; `@keyframes` names may contain "ease"-like words.
    const css = cssOf(file).replace(/@keyframes[\s\S]*?\n\}/g, "");
    for (const m of css.matchAll(PRIMITIVE)) {
      const list = allowed.get(name) ?? [];
      const hit = list.findIndex((u) => m[0].startsWith(u) || u.startsWith(m[0]));
      if (hit < 0) unlisted.push(`${file}: ${m[0]}`);
      else used.add(`${name}\u0000${list[hit]}`);
    }
  }
  assert.deepEqual(unlisted, [], "primitive / literal timing: use the role tokens (--motion-*, --popup-*, --overlay-*) or list it with a reason");
  const stale = [...allowed].flatMap(([file, list]) => list.filter((u) => !used.has(`${file}\u0000${u}`)).map((u) => `${file}.css ${u}`));
  assert.deepEqual([...new Set(stale)], [], "primitive exception no longer occurs: remove it");
});

test("every animating Tailwind utility names its duration and easing (no Tailwind 150 ms defaults)", () => {
  const missing: string[] = [];
  for (const file of files()) {
    const lines = cssOf(file).split("\n");
    for (const [i, line] of lines.entries()) {
      if (!/@apply/.test(line)) continue;
      const utils = line
        .slice(line.indexOf("@apply") + 6)
        .replace(/[;}].*$/, "")
        .trim()
        .split(/\s+/);
      const animates = utils.some((u) => /^(transition(-[\w[\],-]+)?|animate-(in|out))$/.test(u) && u !== "transition-none");
      if (!animates) continue;
      // An exit / variant rule may inherit the easing of its enter rule; the duration must still be explicit.
      // A duration with a fallback chain is set on the next line (`animation-duration: var(--x, var(--role))`).
      const hasDuration = utils.some((u) => /^duration-\(--/.test(u)) || /^\s*(animation|transition)-duration: var\(--/.test(lines[i + 1] ?? "");
      const hasEase = utils.some((u) => /^ease-\(--/.test(u));
      if (!hasDuration || !hasEase) missing.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(missing, [], "add duration-(--<role>-duration) ease-(--<role>-ease)");
});

/** Allowed duration → easing pairs of the shared roles (a role's duration never runs on another role's curve). */
const PAIRS: Record<string, string[]> = {
  "--motion-state-duration": ["--motion-state-ease"],
  "--motion-move-duration": ["--motion-move-ease"],
  "--motion-collapse-duration": ["--motion-collapse-ease"],
  "--motion-indicator-duration": ["--motion-indicator-ease"],
  "--motion-enter-duration": ["--motion-enter-ease"],
  "--motion-exit-duration": ["--motion-enter-ease"],
  "--popup-duration": ["--popup-ease"],
  "--popup-exit-duration": ["--popup-ease"],
  "--overlay-duration": ["--overlay-ease"],
  "--overlay-fade-duration": ["--overlay-ease"],
  "--overlay-exit-duration": ["--overlay-ease"],
};
const STATE_PROPS = /^(color|background-color|background|border-color|outline-color|box-shadow|text-decoration-color|fill|stroke)$/;
const MOVE_PROPS = /^(transform|translate|rotate|scale)$/;

test("role tokens are paired and match the animated property (same role = same duration + easing)", () => {
  const bad: string[] = [];
  for (const file of files()) {
    const css = cssOf(file);
    // CSS `transition:` lists.
    for (const m of css.matchAll(/\btransition:([^;{}]*);/g))
      for (const item of m[1]!.split(/,(?![^(]*\))/)) {
        const prop = item.trim().split(/\s+/)[0] ?? "";
        const dur = item.match(/var\((--(?:motion|popup|overlay)-[\w-]*duration)\)/)?.[1];
        const ease = item.match(/var\((--(?:motion|popup|overlay)-[\w-]*ease)\)/)?.[1];
        if (dur && ease && !PAIRS[dur]?.includes(ease)) bad.push(`${file}: ${item.trim()} (pair)`);
        if (dur && STATE_PROPS.test(prop) && /--motion-(move|collapse|indicator)/.test(dur)) bad.push(`${file}: ${item.trim()} (colour on a motion role)`);
        if (dur && MOVE_PROPS.test(prop) && /--motion-(state|collapse)/.test(dur)) bad.push(`${file}: ${item.trim()} (transform on the state / collapse role)`);
      }
    // Tailwind utilities.
    for (const line of css.split("\n")) {
      const dur = line.match(/\bduration-\((--(?:motion|popup|overlay)-[\w-]*duration)\)/)?.[1];
      const ease = line.match(/\bease-\((--(?:motion|popup|overlay)-[\w-]*ease)\)/)?.[1];
      if (dur && ease && !PAIRS[dur]?.includes(ease)) bad.push(`${file}: ${line.trim()} (pair)`);
    }
  }
  assert.deepEqual(bad, []);
});

/** Same role, same tokens: components that animate the same kind of thing (file → pattern their rules must contain). */
const SAME_ROLE: { role: string; files: string[]; must: RegExp[] }[] = [
  {
    role: "popup (enter + exit)",
    files: [
      "autocomplete",
      "color-picker",
      "combo-box",
      "date-picker",
      "date-range-picker",
      "dropdown",
      "hover-card",
      "popover",
      "select",
      "time-picker",
      "tooltip",
    ],
    must: [/animate-in duration-\(--popup-duration\) ease-\(--popup-ease\)/, /animate-out duration-\(--popup-exit-duration\) ease-\(--popup-ease\)/],
  },
  {
    role: "collapse (panel height)",
    files: ["accordion", "disclosure", "error-message", "field-error"],
    must: [/height var\(--motion-collapse-duration\) var\(--motion-collapse-ease\)/],
  },
  {
    role: "selection indicator",
    files: ["tabs", "segment"],
    must: [
      /transition-duration: var\(--motion-indicator-duration\);\s*transition-property: translate, width, height;\s*transition-timing-function: var\(--motion-indicator-ease\);/,
    ],
  },
  {
    role: "entrance (toast / action bar)",
    files: ["toast", "action-bar"],
    must: [/var\(--motion-enter-duration\)/, /var\(--motion-exit-duration\)/, /var\(--motion-enter-ease\)/],
  },
];

test("same-role components use the same role tokens", () => {
  const bad: string[] = [];
  for (const { role, files: list, must } of SAME_ROLE)
    for (const name of list) {
      const css = cssOf(`${name}.css`);
      for (const re of must) if (!re.test(css)) bad.push(`${name}.css: ${role} ${re.source}`);
    }
  assert.deepEqual(bad, []);
});
