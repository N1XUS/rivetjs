// Resume-fuzz findings on the cdk story app built with lazy rows + DOM-DATA (`RIVET_LAZY_ROWS=on RIVET_LAZY_ROWS_HARNESS=1
// RIVET_DOM_DATA=1`, own build `dist-fuzz-flip`; `./resume-fuzz.test.ts` picks this set under `RIVET_LAZY_ROWS=on`): the
// default pins (`./pins.ts`) minus the ones these builds no longer show, plus the findings only these builds show (LAZY-FLIP
// triage 2026-10-21, each 3/3 on the flip build and 0/3 on the default build; all from lazy rows: a domData-only build shows
// none; LAZY-BLOCKERS 2026-10-21 fixed the SelectionIndicator first-transition one: a `set` materialises the rows it wakes
// before the value changes). Keyed on the flags: when `lazyRows` / `domData` become the default, this set replaces `./pins.ts`.
import type { FuzzPin } from "@rivetjs/testing/fuzz";
import { pins as serialized } from "./pins.ts";

// Default pins these builds fix (3/3 "Expect test to fail" with lazy rows): the rows no longer re-create their region.
const fixed = (pin: FuzzPin): boolean =>
  (pin.route === "/scheduler" && pin.kind === "resume-error") ||
  (pin.route === "/tabs" && pin.kind === "mismatch" && pin.match === "num-tabpanel-2") ||
  (pin.route === "/selection-indicator-groups" && pin.kind === "recreated");

const flipOnly: FuzzPin[] = [
  {
    route: "/select-autofocus",
    kind: "mismatch",
    match: 'csr only [data-focused="true"]',
    owner: "runtime",
    design: true,
    note: "timing: the autofocused trigger focuses before the state script / loader is parsed (lazy rows page: earlier render than the recorded one), so the loader never sees that focus and the Select's `isFocused` stays false until the next focus; the recorded page boots at load from the captured focus. Loader fix (replay a focused `autofocus` element at install) changes default loader bytes: follow-up",
  },
];

export const pins: FuzzPin[] = [...serialized.filter((pin) => !fixed(pin)), ...flipOnly];
