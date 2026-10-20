// Known resume-fuzz findings on the ui story app (triage of the first run, Function Bridge T31, 2026-10-12): each one is
// a `test.fails` with its owner (it fails the suite once fixed: drop the pin then); `design: true` = an accepted or
// non-deterministic difference between a resumed page and a client render (filtered, no `test.fails`). Report:
// docs/design/specs/2026-10-09-function-bridge-design.md §8.5.
import type { FuzzOptions, FuzzPin } from "@rivetjs/testing/fuzz";

// Root causes shared by several routes.
const NO_REGION = "re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha)";
const MOUNT_EFFECT = "a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change)";
const COLD_HOVER = "cold hover: hover state depends on whether the pointer entered before the hover handler's chunk loaded";

// ui /ai-chat streamed reply (story REPLY): a structural difference whose two lines are both reply lines.
const REPLY_LINE =
  '(<(ol|li|p) class="markdown__[^\\n]*|<div class="chat-message chat-message--assistant"[^\\n]*|"(Sure|Here|is|the|The|short|server|streams|HTML|browser|resumes|on|interaction|Done)\\b[^\\n]*)';
const AI_REPLY = new RegExp("^resumed: " + REPLY_LINE + "\\ncsr: " + REPLY_LINE + "$");

const pin = (route: string, kind: FuzzPin["kind"], match: FuzzPin["match"], owner: string, note: string, design?: boolean): FuzzPin => ({
  route,
  kind,
  match,
  owner,
  note,
  ...(design ? { design } : {}),
});

export const pins: FuzzPin[] = [
  // Accepted / non-deterministic differences.
  pin("/ai-chat", "mismatch", "data-copy-timer=", "ui", "copy button stores its timer handle in an attribute (handle values differ per page)", true),
  // Lines of the streamed reply only (markdown parts, the assistant message, text runs starting with a reply word), at
  // the two send steps of the default plan (T31 ui runs: step 26 in 2 of 7, step 33 in 2 of 7).
  ...[26, 33].map((step): FuzzPin => ({
    ...pin("/ai-chat", "mismatch", AI_REPLY, "ui", "simulated streaming reply: timer-driven chunk order", true),
    step,
  })),
  {
    ...pin(
      "/colors",
      "mismatch",
      '<div##9-option-#3B82F6FF>: resumed only [data-hovered="true"] / csr only []',
      "runtime",
      "frame timing: Home scrolls the listbox under the parked pointer, 1 of 6 runs (T31 fix rounds 1–2; not chunk loading)",
      true,
    ),
    step: 29,
  },
  pin("/carousel", "load", 'data-ready="true"', "cdk", "carousel engine starts on the first interaction on a resumed page, at mount in a client render", true),
  pin("/carousel", "mismatch", "data-in-view", "cdk", "carousel engine state (in-view slides) follows its start", true),
  pin("/pro-forms", "load", 'data-roll="true"', "ui", "number roll entrance: " + MOUNT_EFFECT, true),
  pin("/reanimate", "load", 'data-roll="true"', "ui", "number roll entrance: " + MOUNT_EFFECT, true),
  pin("/forms", "load", 'csr only [data-roll="true"]', "ui", "NumberStepper roll entrance (libs/ui/CLAUDE.md reanimate): " + MOUNT_EFFECT, true),
  // ScrollArea deviation (cdk/CLAUDE.md, scroll-area/CLAUDE.md): a resumed area stays native (no scroll-area code) until
  // pointerenter / wheel / focusin / scroll.
  pin("/scroll-area", "load", "overflow-x:scroll", "cdk", "ScrollArea viewport overflow: " + MOUNT_EFFECT, true),

  // Open findings.
  // Cold first click on a NumberField stepper / ComboBox trigger inside a group: the group never gets focus-within (and
  // focus-visible after Escape) on a resumed page. Regressed at ffc60cb8a (UNDO-FOCUS): the cold-press `undoing` window in
  // dom-resume `on()` also swallows the replayed focus that moves into the group (3 of 3 runs; passes at 7ce1445d5).
  ...(
    [
      ["/forms", 11, "focus-within"],
      ["/forms", 14, "focus-visible"],
      ["/morph-icons", 37, "focus-within"],
      ["/morph-icons", 40, "focus-visible"],
    ] as const
  ).map(([route, step, state]): FuzzPin => ({
    ...pin(route, "mismatch", `<div>: resumed only [] / csr only [data-${state}="true"]`, "runtime", "cold focus-back (UNDO-FOCUS) drops the group's " + state),
    step,
  })),
  { ...pin("/action-bar-clear-grid", "recreated", "svg, path", "cdk", "grid rows " + NO_REGION), step: 1 },
  pin("/avatar-group", "recreated", "span#ag-a.avatar", "ui", "Avatar " + NO_REGION),
  { ...pin("/visual/card", "mismatch", 'csr only [data-hovered="true"]', "runtime", COLD_HOVER), step: 11 },
  pin("/data-grid", "recreated", "data-grid__cell", "ui", "DataGrid rows " + NO_REGION),
  pin("/data-grid", "missing", "resumed gone", "ui", "follows the DataGrid row re-creation (the bound element left the resumed page)"),
  pin(
    "/disclosure-group",
    "load",
    'csr only [data-disabled="true"]',
    "ui",
    "DisclosureGroup Next button: server render misses the disabled state of the initial key",
  ),
  pin("/disclosure-group", "mismatch", 'csr: "dg-a"', "ui", "DisclosureGroup Previous/Next: the resumed page steps from a different expanded key"),
  pin("/lightbox", "recreated", "lightbox__slide", "cdk", "Lightbox slides " + NO_REGION),
  pin("/resume", "recreated", "span#l-surface", "ui", "surface span " + NO_REGION),
  pin("/selection-indicator", "recreated", "segment__indicator", "cdk", "SelectionIndicator " + NO_REGION),
  pin("/visual/segment", "recreated", "segment__indicator", "cdk", "SelectionIndicator " + NO_REGION),
  pin("/toggle-buttons", "recreated", "div#tg-live", "ui", "ToggleButtonGroup " + NO_REGION),
  pin(
    "/toggle-buttons",
    "mismatch",
    "touch-action:pan-x pan-y pinch-zoom",
    "ui",
    "follows the ToggleButtonGroup re-creation (re-created buttons lose the press style)",
  ),
  pin("/visual/tag-group", "recreated", "div.tag.tag--md", "cdk", "Tags " + NO_REGION),
  // COLDFIX 2026-10-19: the cold replay no longer re-creates the Tags early (a cold press's queued focus events are
  // dropped), so the old "resumed gone" finding is gone and the fuzz reaches the tag removal (same as cdk `/tag-group`).
  pin(
    "/visual/tag-group",
    "mismatch",
    'csr only [data-focused="true" tabindex="0" :focus]',
    "cdk",
    "removing the focused tag re-creates the Tags (" + NO_REGION + "); focus stays on the body instead of moving to the next tag",
  ),
  pin(
    "/visual/tag-group",
    "mismatch",
    /csr: <div aria-label="Gaming" aria-selected="true"/,
    "cdk",
    "follows the lost focus after a tag removal (above): Enter selects nothing",
  ),
];

/** Per-route fuzz options. */
export const routeOptions = (_route: string): Partial<FuzzOptions> => ({});
