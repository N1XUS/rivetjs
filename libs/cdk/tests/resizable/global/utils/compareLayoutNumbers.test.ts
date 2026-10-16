// Ported from react-resizable-panels (lib/global/utils/compareLayoutNumbers.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { compareLayoutNumbers } from "../../../../resizable/engine/global/utils/compareLayoutNumbers.ts";

describe("compareLayoutNumbers", () => {
  test.each([
    [0, 0, 0],
    [0, 1, -1],
    [0, 25, -1],
    [50, 100, -1],
    [0, -1, 1],
    [50, 25, 1],
    [-50, -100, 1],
  ])("compare: %i, %i -> %i", (a, b, expected) => {
    expect(compareLayoutNumbers(a, b)).toBe(expected);
  });
});
