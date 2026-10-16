// Ported from react-resizable-panels (lib/components/group/sortByDocumentPosition.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { createSiblingElements } from "../../global/test/createSiblingElements.ts";
import { sortByDocumentPosition } from "../../../../resizable/engine/components/group/sortByDocumentPosition.ts";

describe("sortByDocumentPosition", () => {
  test("sortByDocumentPosition", () => {
    const [a, b, c] = createSiblingElements("a", "b", "c");

    expect(sortByDocumentPosition([c, a, b])).toEqual([a, b, c]);
    expect(sortByDocumentPosition([])).toEqual([]);
  });
});
