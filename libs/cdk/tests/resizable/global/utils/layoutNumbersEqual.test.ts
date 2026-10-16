// Ported from react-resizable-panels (lib/global/utils/layoutNumbersEqual.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { layoutNumbersEqual } from "../../../../resizable/engine/global/utils/layoutNumbersEqual.ts";

describe("layoutNumbersEqual", () => {
  test.each([
    [0, 0, true],
    [-1, -1, true],
    [1, 1, true],
    [0, 1, false],
    [0, -1, false],
    [1, -1, false],
    [-1, 1, false],
  ])("compare: %i, %i -> %o", (a, b, expected) => {
    expect(layoutNumbersEqual(a, b)).toBe(expected);
  });
});
