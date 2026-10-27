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
  // the send steps of the default plan (T31 ui runs: step 26 in 2 of 7, step 33 in 2 of 7; COLD-FOCUS 2026-10-20: step 27,
  // the second send key, in 1 of 4 runs).
  ...[26, 27, 33].map((step): FuzzPin => ({
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
  pin(
    "/resizable-c",
    "load",
    "",
    "cdk",
    "resizable groups mount on the first hover / focus / press (flex-grow layout, separator aria-value*; cdk /resizable pin): " + MOUNT_EFFECT,
    true,
  ),

  // Open findings.
  { ...pin("/action-bar-clear-grid", "recreated", "svg, path", "cdk", "grid rows " + NO_REGION), step: 1 },
  pin("/avatar-group", "recreated", "span#ag-a.avatar", "ui", "Avatar " + NO_REGION),
  { ...pin("/visual/card", "mismatch", 'csr only [data-hovered="true"]', "runtime", COLD_HOVER), step: 11 },
  pin(
    "/disclosure-group",
    "load",
    'csr only [data-disabled="true"]',
    "ui",
    "DisclosureGroup Next button: server render misses the disabled state of the initial key",
  ),
  pin("/disclosure-group", "mismatch", 'csr: "dg-a"', "ui", "DisclosureGroup Previous/Next: the resumed page steps from a different expanded key"),
  pin("/lightbox", "recreated", "lightbox__slide", "cdk", "Lightbox slides " + NO_REGION),
  {
    ...pin(
      "/cells-overlays-pro",
      "mismatch",
      'aria-controls="hc-card" aria-describedby="hc-card" aria-expanded="true"',
      "cdk",
      "HoverCard (cdk PreviewTrigger, openDelay 0): a cold first click on the trigger leaves the card open on the resumed page, closed on a client render (same cold-press gap as the cdk /preview-trigger PRESS pin; UI-PORT S2, 3/3 runs)",
    ),
    step: 7,
  },
  // UI-PORT S4b (2026-10-27, 3/3 runs each).
  pin(
    "/list-view",
    "load",
    'resumed only [aria-labelledby="lv-select-ada"]',
    "cdk",
    "GridList rows: the server writes aria-labelledby = row id + description slot id (`grid-list/row.ts` slotRef: the slot id on the server), a client render none when no Text slot=description renders",
  ),
  {
    ...pin(
      "/list-view",
      "mismatch",
      /data-rv-view="19\d\d"/,
      "cdk",
      "virtualized GridList: End on a resumed page renders an earlier window (row 1992) than a client render (row 2000)",
    ),
    step: 17,
  },
  { ...pin("/file-tree", "recreated", "svg, path", "cdk", "Tree rows (lucide icons in TreeItemContent) " + NO_REGION), step: 1 },
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
  // LAZY-FLIP 2026-10-21 (lazy rows on by default; 3/3). The `/data-grid` recreated (`data-grid__cell`) + missing pins left: the rows no longer re-create.
  {
    route: "/data-grid",
    kind: "recreated",
    match: /^svg, path/,
    owner: "ui",
    note: "lazy rows: the first header click re-creates the sort indicator icon (its header region re-creates instead of the rows; `resume.lazyRows: false` builds re-create the rows, `data-grid__cell`)",
  },
  {
    route: "/lightbox",
    kind: "recreated",
    match: "lightbox__image",
    owner: "cdk",
    note: "lazy rows: Lightbox slides re-created on the first change (component without its own region, root CLAUDE.md gotcha); the image goes first, before the slide the default pin names",
  },
];

/** Per-route fuzz options. */
export const routeOptions = (_route: string): Partial<FuzzOptions> => ({});
