// Known resume-fuzz findings on the cdk story app (triage of the first run, Function Bridge T31, 2026-10-12): each one is
// a `test.fails` with its owner (it fails the suite once fixed: drop the pin then); `design: true` = an accepted
// difference between a resumed page and a client render (filtered, no `test.fails`). Report:
// docs/design/specs/2026-10-09-function-bridge-design.md §8.5.
import type { FuzzOptions, FuzzPin } from "@rivetjs/testing/fuzz";

// Root causes shared by several routes.
const COLD_HOVER = "cold hover: the pointer entered before the hover handler's chunk loaded; no hover start is replayed";
const NO_REGION = "re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha)";
const MOUNT_EFFECT = "a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change)";

export const pins: FuzzPin[] = [
  // Accepted differences.
  {
    route: "/carousel",
    kind: "load",
    match: 'data-ready="true"',
    owner: "cdk",
    note: "carousel engine starts on the first interaction on a resumed page, at mount in a client render",
    design: true,
  },
  { route: "/carousel", kind: "mismatch", match: "data-in-view", owner: "cdk", note: "carousel engine state (in-view slides) follows its start", design: true },
  { route: "/resizable", kind: "load", match: /left\\?":30/, owner: "cdk", note: "`onLayoutChange` at mount: " + MOUNT_EFFECT, design: true },
  {
    route: "/select-autofocus",
    kind: "load",
    match: "<button#auto-trigger>: resumed only [:focus]",
    owner: "cdk",
    note: "Select autoFocus: a client render never focuses the trigger (the focusable `clientEffect` calls no `focus()`, probe 2026-10-12); a document load focuses it through the native `autofocus`",
  },
  ...["/grid-list", "/render-resumed", "/selection-indicator-groups", "/virtualized-collections"].map((route): FuzzPin => ({
    route,
    kind: "load",
    match: "resumed only [aria-labelledby=",
    owner: "cdk",
    note: "rows without a description keep the server `aria-labelledby` (no server createSlotId check since UI-COLD 2026-10-08, documented deviation)",
    design: true,
  })),
  // Browser-created parts only (CDK-PINS 2026-10-12, tabs/CLAUDE.md, selection-indicator/CLAUDE.md): server-rendered
  // panels switch without the size transition, a server-rendered indicator does not play its entrance.
  ...["/dom-events-collections", "/selection-indicator", "/tabs"].map((route): FuzzPin => ({
    route,
    kind: "mismatch",
    match: "--tab-panel-height",
    owner: "cdk",
    note: "TabPanels size variables (transition between panel sizes): " + MOUNT_EFFECT,
    design: true,
  })),
  {
    route: "/selection-indicator-groups",
    kind: "load",
    match: 'data-entering="true"',
    owner: "cdk",
    note: "SelectionIndicator entrance: " + MOUNT_EFFECT,
    design: true,
  },

  {
    route: "/dom-events-collections",
    kind: "mismatch",
    match: /^resumed: "[^"]*-enter[^"]*"\ncsr: "[^"]*-enter[^"]*"$/,
    step: 16,
    owner: "cdk",
    note:
      "non-deterministic (3 of 5 T31 runs, always after PageUp): the enter log differs by one `scrollable-enter` / `vp-enter` entry, on either page; " +
      "may be a real double-fire of the ScrollView / viewport enter event (cdk follow-up), filtered meanwhile (ends the DOM comparison that run)",
    design: true,
  },

  {
    route: "/live-props",
    kind: "mismatch",
    match: /<div##\d+-option-\w+>: resumed only \[(data-hovered="true")?\] \/ csr only \[(data-hovered="true")?\]/,
    owner: "runtime",
    note: "timing-dependent (first seen 2026-10-13, fix round 1): a listbox moves under the parked pointer, which option `pointerover` hits depends on frame timing (same class as ui /colors)",
    design: true,
  },

  {
    route: "/tooltip",
    kind: "mismatch",
    match: 'resumed: <span aria-describedby="standalone" id="anchor"',
    step: 37,
    owner: "cdk",
    note: "driver timing (CI-RED 2026-10-20; reached since 78691bab added story elements, on 4d23c2fe too): the click's scroll-into-view `scroll` arrives after a loaded page opened the standalone tooltip, which closes on scroll of the trigger's scroll parent (RA useOverlayPosition); the resumed page replays the cold click after that `scroll`, so its tooltip stays open (pre-scrolled, both pages open it)",
    design: true,
  },

  // Open findings.
  // `/autocomplete` recreated (Autocomplete ListBox, `div#ac-list`) is gone: its pin first failed on CI at 9db8dd7f (passed
  // at acc3f108; in range: CDK-EX's ListBox rows inside a compiled Provider region), 0 findings in 3 of 3 local runs
  // (CI-RED 2026-10-20) — pin dropped.
  { route: "/lightbox", kind: "recreated", match: "rv-LightboxSlide", owner: "cdk", note: "Lightbox slides " + NO_REGION },
  // CI-RED 2026-10-20: the section re-creation pinned here since LAZY-T3 was the engine's first pass on a resumed page
  // publishing an empty window (a click scrolled the scroller past its clamped offset; `virtualizer/state.ts`), fixed.
  // The comparison now runs past the first click.
  {
    route: "/virtualized-collections",
    kind: "mismatch",
    match: '<div#vsections-option-g1-2>: resumed only [] / csr only [data-hovered="true"]',
    step: 8,
    owner: "runtime",
    note: "the first click on a sectioned option: " + COLD_HOVER + " (3 of 3 runs)",
  },
  ...["/list-data", "/virtualized-collections"].map((route): FuzzPin => ({
    route,
    kind: "mismatch",
    match:
      /^resumed: <div class="rv-Virtualizer-item" data-rv-type="item" data-rv-view="[^"]+"[^\n]*\ncsr: <div class="rv-Virtualizer-item" data-rv-type="item" data-rv-view="/,
    owner: "cdk",
    note: "DOM order of virtualized rows after PageUp / PageDown while focus is inside (`rowOrder` keeps the kept rows' DOM order, new rows go last; positions are absolute, so not visible): depends on the window history of each page (1 of 3 runs per route, CI-RED 2026-10-20); ends the DOM comparison that run",
    design: true,
  })),
  {
    route: "/virtualized-collections",
    kind: "mismatch",
    match: /<div#v(sections|menu)-option-[\w-]+>: resumed only \[(data-hovered="true")?\] \/ csr only \[(data-hovered="true")?\]/,
    owner: "runtime",
    note: "timing-dependent (1–2 of 3 runs, CI-RED 2026-10-20): which option the parked pointer hovers after keys scroll the list depends on frame timing (same class as /live-props)",
    design: true,
  },
  {
    route: "/dom-events-collections",
    kind: "mismatch",
    match: '<div#j-list-option-b>: resumed only [data-hovered="true"] / csr only []',
    step: 16,
    owner: "runtime",
    note: "timing-dependent (seen in 1 of 2 runs): replayed hover not cleared by the next key: " + COLD_HOVER,
    design: true,
  },

  {
    route: "/scheduler-zone",
    kind: "load",
    match: /aria-label="Zoned, |, today"/,
    owner: "cdk",
    note: 'scheduler: documented deviation (libs/cdk/scheduler/CLAUDE.md "Pass `timeZone` on SSR pages"): without `timeZone` the server lays out in UTC and the resumed page keeps UTC; the story omits `timeZone` on purpose, the client render uses the browser zone',
    design: true,
  },
  {
    route: "/scheduler",
    kind: "resume-error",
    match: "scheduler/month.tsx#SchedulerMonth$",
    owner: "cdk",
    note: "scheduler (T-lane): SchedulerMonth resumed symbols read fields of an undefined cell / week (`label`, `dayNumber`, `segments`, …) after month-grid keys (CDK-PINS fuzz 2026-10-12)",
  },
  {
    route: "/region-state-repro",
    kind: "recreated",
    match: "#nested-row",
    owner: "runtime",
    note: "repro route of the region re-creation limit: " + NO_REGION,
  },
  { route: "/region-state-repro", kind: "recreated", match: "#flat-row", owner: "runtime", note: "repro route of the region re-creation limit: " + NO_REGION },
  {
    route: "/region-state-repro",
    kind: "recreated",
    match: "#linked-row",
    owner: "runtime",
    note: "repro route of the region re-creation limit: " + NO_REGION,
  },
  { route: "/selection-indicator-groups", kind: "recreated", match: "rv-SelectionIndicator", owner: "cdk", note: "SelectionIndicator " + NO_REGION },
  { route: "/slots", kind: "recreated", match: "input#d1-input", owner: "cdk", note: "slotted Input " + NO_REGION },
  {
    route: "/slots",
    kind: "missing",
    match: "resumed gone",
    owner: "cdk",
    note: "follows the slotted Input re-creation (the bound element left the resumed page)",
  },
  {
    route: "/tabs",
    kind: "load",
    match: 'resumed only [tabindex="0"]',
    owner: "cdk",
    note: "TabPanel: the server writes tabindex=0 (cannot see tabbable content), the client render drops it (RA useHasTabbableChild; needs a runtime post-children attribute, CDK-PINS request)",
  },
  {
    route: "/tabs",
    kind: "mismatch",
    match: "num-tabpanel-2",
    owner: "cdk",
    note: "follows the server TabPanel tabindex=0 (the panel takes focus on the resumed page)",
  },
  { route: "/tag-group", kind: "recreated", match: "rv-Tag", owner: "cdk", note: "Tags " + NO_REGION },
  // COLDFIX 2026-10-19: the cold replay no longer re-creates the Tags before the remove button click (the replayed focus
  // events of a cold press are dropped), so the old "resumed gone" finding is gone and the fuzz now reaches the removal.
  {
    route: "/tag-group",
    kind: "mismatch",
    match: 'csr only [data-focused="true" tabindex="0" :focus]',
    owner: "cdk",
    note: "removing the focused tag (its Remove button) re-creates the Tags (" + NO_REGION + "); focus stays on the body instead of moving to the next tag",
  },
  {
    route: "/tag-group",
    kind: "mismatch",
    match: 'csr: <div aria-describedby="#5" aria-label="Gaming"',
    owner: "cdk",
    note: "follows the lost focus after a tag removal (above): ArrowDown moves nothing on the resumed page",
  },
];

/** Per-route fuzz options. */
export const routeOptions = (_route: string): Partial<FuzzOptions> => ({});
