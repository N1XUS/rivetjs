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
      status: ["1.6s"],
      "qr-code": ["1.6s", "3.2s"],
    },
  },
  { reason: "MASONRY lane owns masonry.css", uses: { masonry: ["150ms"] } },
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
