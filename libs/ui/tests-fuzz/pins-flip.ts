// Resume-fuzz findings on the ui story app built with lazy rows + DOM-DATA (`RIVET_LAZY_ROWS=on RIVET_LAZY_ROWS_HARNESS=1
// RIVET_DOM_DATA=1`, own build `dist-fuzz-flip`; `./resume-fuzz.test.ts` picks this set under `RIVET_LAZY_ROWS=on`): the
// default pins (`./pins.ts`) minus the ones these builds no longer show, plus the findings only these builds show (LAZY-FLIP
// triage 2026-10-21, 3/3 on the flip build after the `_svgShapes` adopt fix). Keyed on the flags: when `lazyRows` /
// `domData` become the default, this set replaces `./pins.ts`.
import type { FuzzPin } from "@rivetjs/testing/fuzz";
import { pins as serialized } from "./pins.ts";

// Default pins these builds fix (3/3 "Expect test to fail"): DataGrid rows are lazy, so they are no longer re-created.
const fixed = (pin: FuzzPin): boolean => pin.route === "/data-grid" && (pin.kind === "recreated" || pin.kind === "missing");

const flipOnly: FuzzPin[] = [
  {
    route: "/data-grid",
    kind: "recreated",
    match: /^svg, path/,
    owner: "ui",
    note: "lazy rows: the first header click re-creates the sort indicator icon (its header region re-creates instead of the rows; the default build re-creates the rows, `data-grid__cell`)",
  },
  {
    route: "/lightbox",
    kind: "recreated",
    match: "lightbox__image",
    owner: "cdk",
    note: "lazy rows: Lightbox slides re-created on the first change (component without its own region, root CLAUDE.md gotcha); the image goes first, before the slide the default pin names",
  },
];

export const pins: FuzzPin[] = [...serialized.filter((pin) => !fixed(pin)), ...flipOnly];
