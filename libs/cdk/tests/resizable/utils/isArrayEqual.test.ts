// Ported from react-resizable-panels (lib/utils/isArrayEqual.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../setup.ts";
import { describe, expect, test } from "vitest";
import { isArrayEqual } from "../../../resizable/engine/utils/isArrayEqual.ts";

describe("isArrayEqual", () => {
  test("should work", () => {
    expect(isArrayEqual([1, 2], [1])).toBe(false);
    expect(isArrayEqual([1], [1, 2])).toBe(false);
    expect(isArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });
});
