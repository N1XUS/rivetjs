// Ported from react-resizable-panels (lib/global/utils/formatLayoutNumber.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { formatLayoutNumber } from "../../../../resizable/engine/global/utils/formatLayoutNumber.ts";

describe("formatLayoutNumber", () => {
  test.each([
    [0, 0],
    [0.1, 0.1],
    [0.12, 0.12],
    [0.123, 0.123],
    [0.123, 0.123],
    [0.5551, 0.555],
    [0.5559, 0.556],
    [-0.1, -0.1],
    [-0.12, -0.12],
    [-0.123, -0.123],
    [-0.123, -0.123],
    [-0.1234, -0.123],
    [-0.5551, -0.555],
    [-0.5559, -0.556],
  ])("format: %i -> %i", (input, expected) => {
    expect(formatLayoutNumber(input)).toBe(expected);
  });
});
