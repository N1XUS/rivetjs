// Known resume-fuzz findings on the cdk story app (triage of the first run, Function Bridge T31, 2026-10-12): each one is
// a `test.fails` with its owner (it fails the suite once fixed: drop the pin then); `design: true` = an accepted
// difference between a resumed page and a client render (filtered, no `test.fails`). Report:
// docs/design/specs/2026-10-09-function-bridge-design.md §8.5.
import type { FuzzOptions, FuzzPin } from "@rivetjs/testing/fuzz";

// Root causes shared by several routes.
const COLD_STEPPER =
  "cold first stepper press, split live / cold (RESUME-PINS diagnosis 2026-10-13): after the settle the pointerdown handler's chunk is evaluated but the mousedown one's is not, so the live press start steps the value and focuses the input, then the browser's mousedown default (no RA preventFocus yet: that handler is cold) moves focus to the stepper — the input's blur runs RA commitAndAnnounce, whose DOM text still shows the old value, so it announces the new one (live announcer); a loaded page keeps focus on the input (no blur, no announce). Follow-up (runtime): queue a pointerdown cold while the same element's mousedown chunk is unevaluated, or evaluate an element's press chunks together; docs/guides/resumability.md \"Cold press\"";
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
  ...["/grid-list", "/render-resumed", "/selection-indicator-groups"].map((route): FuzzPin => ({
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

  // Open findings.
  { route: "/autocomplete", kind: "recreated", match: "div#ac-list", owner: "cdk", note: "Autocomplete ListBox " + NO_REGION },
  { route: "/grid-list", kind: "recreated", match: "rv-GridListItem", owner: "cdk", note: "GridList rows " + NO_REGION },
  { route: "/lightbox", kind: "recreated", match: "rv-LightboxSlide", owner: "cdk", note: "Lightbox slides " + NO_REGION },
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
  { route: "/number-field", kind: "mismatch", step: 1, match: 'resumed: <div data-live-announcer="true"', owner: "runtime", note: COLD_STEPPER },
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
  { route: "/tag-group", kind: "missing", match: "resumed gone", owner: "cdk", note: "follows the Tag re-creation (the bound element left the resumed page)" },
];

/** Per-route fuzz options. */
export const routeOptions = (_route: string): Partial<FuzzOptions> => ({});
