// Ported from react-resizable-panels (lib/global/utils/getDistanceBetweenPointAndRect.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first.
import "../../setup.ts";
import { describe, expect, test } from "vitest";
import { getDistanceBetweenPointAndRect } from "../../../../resizable/engine/global/utils/getDistanceBetweenPointAndRect.ts";

describe("getDistanceBetweenPointAndRect", () => {
  const rect = new DOMRect(25, 25, 100, 50);

  test("should report the distance between the nearest border and an external point", () => {
    expect(getDistanceBetweenPointAndRect({ x: 5, y: 10 }, rect)).toEqual({
      x: 20,
      y: 15,
    });

    expect(getDistanceBetweenPointAndRect({ x: 175, y: 100 }, rect)).toEqual({
      x: 50,
      y: 25,
    });
  });

  test("should report the distance between the nearest border and an external point alt", () => {
    expect(getDistanceBetweenPointAndRect({ x: 35, y: 10 }, rect)).toEqual({
      x: 0,
      y: 15,
    });

    expect(getDistanceBetweenPointAndRect({ x: 175, y: 75 }, rect)).toEqual({
      x: 50,
      y: 0,
    });
  });

  test("should report the distance between the nearest border and an internal point", () => {
    expect(getDistanceBetweenPointAndRect({ x: 35, y: 55 }, rect)).toEqual({
      x: 0,
      y: 0,
    });

    expect(getDistanceBetweenPointAndRect({ x: 110, y: 70 }, rect)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
