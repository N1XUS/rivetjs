// Ported from react-resizable-panels (lib/global/styles/parseSizeAndUnit.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { parseSizeAndUnit } from "../../../../resizable/engine/global/styles/parseSizeAndUnit.ts";

describe("parseSizeAndUnit", () => {
  describe("implicit units", () => {
    test("% units", () => {
      expect(parseSizeAndUnit("50")).toEqual([50, "%"]);
    });

    test("px units", () => {
      expect(parseSizeAndUnit(50)).toEqual([50, "px"]);
    });
  });

  describe("explicit units", () => {
    test("% units", () => {
      expect(parseSizeAndUnit("50%")).toEqual([50, "%"]);
    });

    test("px units", () => {
      expect(parseSizeAndUnit("50px")).toEqual([50, "px"]);
    });

    test("rem units", () => {
      expect(parseSizeAndUnit("50rem")).toEqual([50, "rem"]);
    });

    test("em units", () => {
      expect(parseSizeAndUnit("50em")).toEqual([50, "em"]);
    });

    test("vh units", () => {
      expect(parseSizeAndUnit("50vh")).toEqual([50, "vh"]);
    });

    test("vw units", () => {
      expect(parseSizeAndUnit("50vw")).toEqual([50, "vw"]);
    });
  });
});
