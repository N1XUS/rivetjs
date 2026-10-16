// Rivet tests for the pure helpers of `@rivetjs/cdk/sheet-motion` (Rivet-authored sheet drag / snap motion): snap point
// sizes, the first-render CSS transform, backdrop fade between snap points, rubber band past the drag limits.
import { describe, expect, it } from "vitest";
import { SHEET_RUBBER_BAND, isVerticalSheet, rubberBand, sheetBackdropOpacity, snapPointSize, snapPointTransform } from "../sheet-motion/index.ts";

const VIEWPORT = { width: 400, height: 800 };

describe("snapPointSize", () => {
  it("fractions of the viewport along the axis", () => {
    expect(snapPointSize(0.5, VIEWPORT, true)).toBe(400);
    expect(snapPointSize(0.5, VIEWPORT, false)).toBe(200);
    expect(snapPointSize(1, VIEWPORT, true)).toBe(800);
  });
  it("CSS lengths", () => {
    expect(snapPointSize("148px", VIEWPORT, true)).toBe(148);
    expect(snapPointSize("10rem", VIEWPORT, true, 16)).toBe(160);
    expect(snapPointSize("2em", VIEWPORT, true, 20)).toBe(40);
    expect(snapPointSize("50dvh", VIEWPORT, true)).toBe(400);
    expect(snapPointSize("50vw", VIEWPORT, true)).toBe(200);
    expect(snapPointSize("25%", VIEWPORT, true)).toBe(200);
    expect(snapPointSize("25%", VIEWPORT, false)).toBe(100);
    expect(snapPointSize("120", VIEWPORT, true)).toBe(120);
  });
  it("numbers above 1 are px; unknown strings 0", () => {
    expect(snapPointSize(300, VIEWPORT, true)).toBe(300);
    expect(snapPointSize("auto", VIEWPORT, true)).toBe(0);
  });
});

describe("snapPointTransform", () => {
  it("bottom / top / right / left", () => {
    expect(snapPointTransform("bottom", 0.5)).toBe("translateY(max(0px, calc(100% - 50dvh)))");
    expect(snapPointTransform("top", "148px")).toBe("translateY(calc(-1 * max(0px, calc(100% - 148px))))");
    expect(snapPointTransform("right", 0.25)).toBe("translateX(max(0px, calc(100% - 25dvw)))");
    expect(snapPointTransform("left", "40%")).toBe("translateX(calc(-1 * max(0px, calc(100% - 40dvw))))");
    expect(snapPointTransform("bottom", undefined)).toBeUndefined();
  });
  it("axis", () => {
    expect(isVerticalSheet("bottom")).toBe(true);
    expect(isVerticalSheet("left")).toBe(false);
  });
});

describe("sheetBackdropOpacity", () => {
  it("without snap points: fades with the offset", () => {
    expect(sheetBackdropOpacity(0, 400, [], 0)).toBe(1);
    expect(sheetBackdropOpacity(100, 400, [], 0)).toBe(0.75);
    expect(sheetBackdropOpacity(400, 400, [], 0)).toBe(0);
  });
  it("snap points: opaque from fadeFrom, transparent at the previous point, linear between", () => {
    // offsets of three points on a 600 px sheet: 400 (index 0), 200 (1), 0 (2)
    const offsets = [400, 200, 0];
    expect(sheetBackdropOpacity(0, 600, offsets, 2)).toBe(1);
    expect(sheetBackdropOpacity(100, 600, offsets, 2)).toBe(0.5);
    expect(sheetBackdropOpacity(200, 600, offsets, 2)).toBe(0);
    expect(sheetBackdropOpacity(400, 600, offsets, 2)).toBe(0);
    expect(sheetBackdropOpacity(300, 600, offsets, 1)).toBe(0.5);
    // fadeFrom 0: fades out between the first point and closed
    expect(sheetBackdropOpacity(500, 600, offsets, 0)).toBe(0.5);
  });
});

describe("rubberBand", () => {
  it("inside the limits follows the pointer, past them damped", () => {
    expect(rubberBand(50, [0, 100])).toBe(50);
    expect(rubberBand(-50, [0, 100])).toBe(-50 * SHEET_RUBBER_BAND);
    expect(rubberBand(150, [0, 100])).toBe(100 + 50 * SHEET_RUBBER_BAND);
  });
});
