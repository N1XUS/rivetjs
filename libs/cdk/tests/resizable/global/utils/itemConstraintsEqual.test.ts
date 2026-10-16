// Ported from react-resizable-panels (lib/global/utils/itemConstraintsEqual.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import type { ResizeItemConstraints } from "../../../../resizable/engine/global/types.ts";
import { itemConstraintsEqual } from "../../../../resizable/engine/global/utils/itemConstraintsEqual.ts";

function createPanelConstraints(partial: { itemId: string } & Partial<ResizeItemConstraints>): ResizeItemConstraints {
  return {
    collapsedSize: 0,
    collapsible: false,
    defaultSize: undefined,
    disabled: undefined,
    maxSize: 100,
    minSize: 0,
    ...partial,
  };
}

const cases: [ResizeItemConstraints[], ResizeItemConstraints[], boolean][] = [
  [[], [], true],
  [[], [createPanelConstraints({ itemId: "a" })], false],
  [[createPanelConstraints({ itemId: "a" })], [], false],
  [[createPanelConstraints({ itemId: "a" })], [createPanelConstraints({ itemId: "a" })], true],
  [
    [createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b" })],
    [createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b" })],
    true,
  ],
  [[createPanelConstraints({ itemId: "a" })], [createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b" })], false],
  [[createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b" })], [createPanelConstraints({ itemId: "a" })], false],
  [
    [createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b" })],
    [createPanelConstraints({ itemId: "a" }), createPanelConstraints({ itemId: "b", disabled: true })],
    false,
  ],
  [[createPanelConstraints({ itemId: "a", collapsible: false })], [createPanelConstraints({ itemId: "a", collapsible: true })], false],
];

describe("itemConstraintsEqual", () => {
  test.each(cases)("objectsEqual: %o, %o -> %o", (a, b, expected) => {
    expect(itemConstraintsEqual(a, b)).toBe(expected);
  });
});
