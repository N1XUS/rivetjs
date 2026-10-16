// Ported from react-resizable-panels (lib/global/utils/objectsEqual.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { objectsEqual } from "../../../../resizable/engine/global/utils/objectsEqual.ts";

describe("objectsEqual", () => {
  test.each([
    [{}, {}, true],
    [{ a: 25, b: 75 }, { a: 25, b: 75 }, true],
    [{ a: 75, b: 25 }, { a: 75, b: 25 }, true],
    [{}, { a: 25, b: 75 }, false],
    [{ a: 25, b: 75 }, {}, false],
    [{ a: 25, b: 75 }, { a: 75, b: 25 }, false],
    [{ a: 75, b: 25 }, { a: 25, b: 75 }, false],
    [{ a: 25, b: 75 }, { a: 75 }, false],
    [{ a: 75 }, { a: 25, b: 75 }, false],
  ])("objectsEqual: %o, %o -> %o", (a, b, expected) => {
    expect(objectsEqual(a, b)).toBe(expected);
  });
});
