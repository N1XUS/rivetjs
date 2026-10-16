// Motion tokens (identity spec 2026-10-11 §3.6, TWEAKS.md TW-141): every transition / animation duration in the component
// stylesheets (`styles/components/*.css`) is `var(--duration-fast | base | slow)` (120 / 180 / 260 ms, shared theme), an overlay
// token (`--overlay-duration` / `-fade-duration` / `-exit-duration` + `--overlay-ease`, TW-146: Drawer / Sheet / Modal) or a
// listed exception with its reason; `--ease-smooth` is the standard curve. New literal durations fail; an exception that
// no longer occurs fails too (stale).
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
    },
  },
  { reason: "MASONRY lane owns masonry.css", uses: { masonry: ["150ms"] } },
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

test("Drawer / Sheet / Modal take their timing from the overlay tokens only", () => {
  for (const name of ["drawer", "sheet", "modal"]) {
    const css = readFileSync(new URL(`${name}.css`, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /cubic-bezier\(0\.32/, `${name}: literal sheet curve`);
    assert.match(css, /var\(--overlay-duration\)|duration-\(--overlay-duration\)/, `${name}: panel enter`);
    assert.match(css, /--overlay-exit-duration/, `${name}: exit`);
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
