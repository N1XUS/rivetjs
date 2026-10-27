// Spacing scale (identity spec 2026-10-11 §3.2, TWEAKS.md TW-136): every padding / gap utility in the component
// stylesheets (`styles/components/*.css`, `@apply` lines) is a step of the 4-pt scale `--space-1…8`
// (4 / 6 / 8 / 12 / 16 / 24 / 36 / 52 px = Tailwind units 1 / 1.5 / 2 / 3 / 4 / 6 / 9 / 13; 0 and `px` allowed) or a
// listed exception with its reason. New off-scale values fail; an exception that no longer occurs fails too (stale).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../styles/components/", import.meta.url);
const theme = readFileSync(new URL("../styles/themes/shared/theme.css", import.meta.url), "utf8");

/** Scale steps in px (`--space-1…8`). */
const SCALE = [4, 6, 8, 12, 16, 24, 36, 52];
const ALLOWED = new Set(["0", "px", ...SCALE.map((px) => String(px / 4))]);

/** Off-scale utilities kept, by reason (file → utilities). */
const EXCEPTIONS: { reason: string; uses: Record<string, string[]> }[] = [
  {
    reason: "2 px optical gap inside a dense cluster (icon + label pills, segmented tracks, rating stars, title stacks)",
    uses: {
      badge: ["gap-0.5", "px-0.5"],
      chip: ["gap-0.5", "px-0.5"],
      "chat-list-view": ["gap-0.5"],
      "item-card": ["gap-0.5"],
      "item-card-group": ["gap-0.5"],
      "number-value": ["gap-0.5"],
      "chat-message-actions": ["gap-0.5"],
      "chat-message": ["gap-0.5", "pt-0.5"],
      "checkbox-button-group": ["gap-0.5"],
      "floating-toc": ["gap-0.5"],
      "radio-button-group": ["gap-0.5"],
      dropdown: ["gap-0.5"],
      kbd: ["space-x-0.5"],
      "prompt-input": ["gap-0.5"],
      rating: ["gap-0.5"],
      segment: ["gap-0.5"],
      stepper: ["gap-0.5"],
      sidebar: ["gap-0.5", "p-0.5", "py-0.5"],
      calendar: ["px-0.5"],
      "range-calendar": ["px-0.5"],
      "date-input-group": ["px-0.5"],
      chart: ["px-0.5"],
      markdown: ["ps-0.5", "py-0.5"],
      typography: ["py-0.5"],
    },
  },
  {
    reason:
      "10 px inset of pill items / overlay labels (popover list items aligned to the 18 px concentric radius, pagination ellipsis, carousel / compare counters)",
    uses: {
      autocomplete: ["px-2.5"],
      "combo-box": ["px-2.5"],
      select: ["px-2.5"],
      dropdown: ["pe-2.5", "ps-2.5"],
      "calendar-year-picker": ["px-2.5"],
      carousel: ["px-2.5"],
      compare: ["px-2.5"],
      morph: ["px-2.5"],
      pagination: ["px-2.5"],
      sidebar: ["p-2.5", "px-2.5"],
    },
  },
  {
    reason: "10 px vertical rhythm of 40 px rows (table header / footer, chat bubbles and tool rows) and chat stacks",
    uses: { table: ["py-2.5"], "chat-message": ["py-2.5"], "chat-source": ["py-2.5"], "chat-tool": ["gap-2.5", "py-2.5"], "chat-attachment": ["gap-2.5"] },
  },
  {
    reason: "room reserved for an absolutely positioned indicator / icon (= its size + inset, derived, not a gap)",
    uses: {
      autocomplete: ["pe-7"],
      "combo-box": ["pe-7"],
      select: ["pe-7"],
      "list-box-item": ["pe-7"],
      "menu-item": ["pe-7", "ps-7"],
      checkbox: ["ps-7"],
      radio: ["ps-7"],
      "native-select": ["pe-8"],
      "checkbox-button-group": ["pe-10"],
      "radio-button-group": ["pe-10"],
      sidebar: ["pe-8", "pe-12", "pe-14"],
      switch: ["ps-[calc(2rem+0.75rem)]", "ps-[calc(2.5rem+0.75rem)]", "ps-[calc(3rem+0.75rem)]"],
    },
  },
  {
    reason: "3 px breathing room for the focus ring of a full-bleed dialog",
    uses: { "alert-dialog": ["p-[3px]"], modal: ["p-[3px]"], drawer: ["p-[3px]"], sheet: ["p-[3px]"] },
  },
  {
    reason: "14 px iOS-style inset-grouped cell rows",
    uses: { "cell-color-picker": ["px-3.5"], "cell-select": ["px-3.5"], "cell-slider": ["px-3.5"], "cell-switch": ["px-3.5"] },
  },
  { reason: "spec §3.2 ratio: Button lg 20 / 10 (2.25 : 1 pill ratio wins over the scale)", uses: { button: ["px-5"] } },
  { reason: "list marker indent (1.25 em)", uses: { markdown: ["ps-5"] } },
  { reason: "3 px bar gap of a dense chart series", uses: { chart: ["gap-[3px]"] } },
  {
    reason: "20 px morph panel inset (concentric with its 28 px outer radius) and 32 px navbar gutter (page grid, not a control)",
    uses: { morph: ["p-5"], navbar: ["px-8"] },
  },
  { reason: "MASONRY lane owns masonry.css (empty state 40 px, map to 36 there)", uses: { masonry: ["py-10"] } },
];

const UTILITY = /(?<![\w-])(?:[a-z0-9]+:)*-?(?:p|px|py|pt|pb|ps|pe|pl|pr|gap|gap-x|gap-y|space-x|space-y)-(\[[^\]]+\]|[0-9.]+|px)(?![\w.-])/g;

function offScale(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "index.css")) {
    const name = file.slice(0, -4);
    for (const line of readFileSync(new URL(file, dir), "utf8").split("\n")) {
      if (!line.includes("@apply")) continue;
      for (const m of line.matchAll(UTILITY)) {
        if (ALLOWED.has(m[1]!)) continue;
        const utility = m[0].replace(/^(?:[a-z0-9]+:)*-?/, "");
        if (!found.has(name)) found.set(name, new Set());
        found.get(name)!.add(utility);
      }
    }
  }
  return found;
}

test("theme declares the spacing scale --space-1…8", () => {
  const steps = [...theme.matchAll(/--space-(\d): ([\d.]+)rem;/g)].map((m) => [Number(m[1]), Number(m[2]) * 16]);
  assert.deepEqual(
    steps,
    SCALE.map((px, i) => [i + 1, px]),
  );
});

test("every padding / gap utility in component CSS is a scale step or a listed exception", () => {
  const allowed = new Map<string, Set<string>>();
  for (const { uses } of EXCEPTIONS)
    for (const [file, list] of Object.entries(uses)) for (const u of list) (allowed.get(file) ?? allowed.set(file, new Set()).get(file)!).add(u);
  const found = offScale();
  const unlisted = [...found].flatMap(([file, set]) => [...set].filter((u) => !allowed.get(file)?.has(u)).map((u) => `${file}.css ${u}`));
  assert.deepEqual(unlisted, [], "off-scale padding / gap: map it to a step (4/6/8/12/16/24/36/52 px) or list it with a reason");
  const stale = [...allowed].flatMap(([file, set]) => [...set].filter((u) => !found.get(file)?.has(u)).map((u) => `${file}.css ${u}`));
  assert.deepEqual(stale, [], "exception no longer occurs: remove it");
});
