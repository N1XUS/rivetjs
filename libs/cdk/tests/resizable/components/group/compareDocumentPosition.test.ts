// Ported from react-resizable-panels (lib/components/group/compareDocumentPosition.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { createSiblingElements } from "../../global/test/createSiblingElements.ts";
import { compareDocumentPosition } from "../../../../resizable/engine/components/group/compareDocumentPosition.ts";

describe("compareDocumentPosition", () => {
  test("compareDocumentPosition", () => {
    const [first, second] = createSiblingElements("first", "second");

    expect(compareDocumentPosition(first, second)).toBe(-1);
    expect(compareDocumentPosition(second, first)).toBe(1);
    expect(compareDocumentPosition(first, first)).toBe(0);
  });

  test("compareDocumentPosition treats disconnected elements as equal", () => {
    const [a] = createSiblingElements("a");
    const detached = document.createElement("div");

    expect(compareDocumentPosition(a, detached)).toBe(0);
    expect(compareDocumentPosition(detached, a)).toBe(0);
  });
});
