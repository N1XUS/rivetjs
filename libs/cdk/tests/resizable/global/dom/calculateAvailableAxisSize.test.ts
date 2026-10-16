// Ported from react-resizable-panels (lib/global/dom/calculateAvailableAxisSize.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { mockGroup } from "../test/mockGroup.ts";
import { calculateAvailableAxisSize } from "../../../../resizable/engine/global/dom/calculateAvailableAxisSize.ts";

describe("calculateAvailableAxisSize", () => {
  test("panel widths", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), {
      orientation: "horizontal",
    });
    group.addPanel(new DOMRect(0, 0, 25, 50));
    group.addPanel(new DOMRect(0, 0, 75, 50));

    expect(calculateAvailableAxisSize({ axis: group })).toBe(100);
  });

  test("panel widths, excluding separators", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), {
      orientation: "horizontal",
    });
    group.addHTMLElement(new DOMRect(0, 0, 10, 50));
    group.addPanel(new DOMRect(0, 0, 20, 50));
    group.addPanel(new DOMRect(0, 0, 30, 50));
    group.addHTMLElement(new DOMRect(0, 0, 10, 50));

    expect(calculateAvailableAxisSize({ axis: group })).toBe(50);
  });

  test("panel widths, excluding other DOM elements", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), {
      orientation: "horizontal",
    });
    group.addPanel(new DOMRect(0, 0, 49, 50));
    group.addSeparator(new DOMRect(0, 0, 2, 50));
    group.addPanel(new DOMRect(0, 0, 49, 50));

    expect(calculateAvailableAxisSize({ axis: group })).toBe(98);
  });

  test("panel widths, excluding flex padding, gap, or margins", () => {
    const group = mockGroup(new DOMRect(0, 0, 100, 50), {
      orientation: "horizontal",
    });
    group.addPanel(new DOMRect(0, 0, 45, 50));
    group.addPanel(new DOMRect(0, 0, 45, 50));

    expect(calculateAvailableAxisSize({ axis: group })).toBe(90);
  });
});
