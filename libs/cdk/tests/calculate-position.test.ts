// Port of React Aria's calculatePosition.test.ts (Apache-2.0, © Adobe): placement, flip, offsets,
// cross offsets, boundary padding, provider (boundary) offset, arrow boundary offset. happy-dom with
// mocked layout stands in for jsdom.
import { describe, test, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { installDom, mockLayout, defined } from "./install-dom.ts";

const dom = installDom();
const { calculatePosition } = await import("../overlay/position.ts");
type Placement = import("../overlay/position.ts").Placement;

const FLIPPED_DIRECTION: Record<string, string> = { left: "right" };

type Box = { top: number; left: number; width?: number; height?: number };
function getTargetDimension(targetPosition: { top: number; left: number }, height = 100, width = 100): Box {
  return { ...targetPosition, width, height };
}

const containerDimensions = { width: 600, height: 600, top: 0, left: 0 };
const boundaryDimensions = { width: 600, height: 600, top: 0, left: 0 };
const overlaySize = { width: 200, height: 200 };
const PROVIDER_OFFSET = 50;

function createElementWithDimensions(dimensions: Box): HTMLElement {
  const elem = document.createElement("div");
  Object.assign(elem.style, {
    width: `${dimensions.width ?? 0}px`,
    height: `${dimensions.height ?? 0}px`,
    top: `${dimensions.top}px`,
    left: `${dimensions.left}px`,
    margin: "0px",
  });
  mockLayout(elem, dimensions);
  return elem;
}

type Expected = [number, number, number | undefined, number | undefined, number];

function checkPositionCommon(
  title: string,
  expected: Expected,
  placement: Placement,
  targetDimension: Box,
  offset: number,
  crossOffset: number,
  flip?: boolean,
  providerOffset = 0,
  arrowSize = 8,
  arrowBoundaryOffset = 0,
) {
  test(title, () => {
    const [placementAxis, placementCrossAxis] = placement.split(" ") as [string, string | undefined];
    // Expectations are top / left based: convert to bottom / right where the engine uses those.
    const pos: { right?: number; top?: number; left?: number; bottom?: number } = {};
    if ((placementAxis === "left" && !flip) || (placementAxis === "right" && flip)) {
      pos.right = containerDimensions.width - (expected[0] + overlaySize.width);
      pos.top = expected[1];
    } else if ((placementAxis === "right" && !flip) || (placementAxis === "left" && flip)) {
      pos.left = expected[0];
      pos.top = expected[1];
    } else if (placementAxis === "top") {
      pos.left = expected[0];
      pos.bottom = containerDimensions.height - (expected[1] + overlaySize.height);
    } else if (placementAxis === "bottom") {
      pos.left = expected[0];
      pos.top = expected[1];
    }
    const calculatedPlacement = flip ? FLIPPED_DIRECTION[placementAxis]! : placementAxis;
    // A cross axis of `bottom` grows towards the top.
    const maxHeight = expected[4] - (placementAxis !== "top" && placementCrossAxis !== "bottom" ? providerOffset : 0);
    const expectedPosition = {
      position: pos,
      arrowOffsetLeft: expected[2],
      arrowOffsetTop: expected[3],
      maxHeight,
      placement: calculatedPlacement,
      triggerAnchorPoint: {
        x: expected[2] ?? (calculatedPlacement === "left" ? overlaySize.width : 0),
        y: expected[3] ?? (calculatedPlacement === "top" ? Math.min(overlaySize.height, maxHeight) : 0),
      },
    };

    const container = createElementWithDimensions(containerDimensions);
    container.style.position = "relative";
    const target = createElementWithDimensions(targetDimension);
    const overlay = createElementWithDimensions(overlaySize as Box);
    const parentElement = document.createElement("div");
    parentElement.appendChild(container);
    parentElement.appendChild(target);
    container.appendChild(overlay);
    document.documentElement.appendChild(parentElement);
    const boundariesElem = createElementWithDimensions({ ...boundaryDimensions, height: boundaryDimensions.height - providerOffset });
    parentElement.appendChild(boundariesElem);

    const result = calculatePosition({
      placement,
      overlayNode: overlay,
      targetNode: target,
      scrollNode: overlay,
      padding: 50,
      shouldFlip: !!flip,
      boundaryElement: boundariesElem,
      offset,
      crossOffset,
      arrowSize,
      arrowBoundaryOffset,
    });
    assert.deepEqual(defined(result), defined(expectedPosition));
    document.documentElement.removeChild(parentElement);
  });
}

function checkPosition(
  placement: Placement,
  targetDimension: Box,
  expected: Expected,
  offset = 0,
  crossOffset = 0,
  flip?: boolean,
  providerOffset?: number,
  arrowSize?: number,
  arrowBoundaryOffset?: number,
) {
  checkPositionCommon(
    "Should calculate the correct position",
    expected,
    placement,
    targetDimension,
    offset,
    crossOffset,
    flip,
    providerOffset,
    arrowSize,
    arrowBoundaryOffset,
  );
}

function checkPositionForProvider(placement: Placement, targetDimension: Box, expected: Expected, offset = 0, crossOffset = 0, flip = false) {
  checkPositionCommon(
    "Should calculate the correct position when provider does not start at top of screen",
    expected,
    placement,
    targetDimension,
    offset,
    crossOffset,
    flip,
    PROVIDER_OFFSET,
  );
}

const u = undefined;
const testCases: { placement: Placement; [k: string]: Expected | Placement }[] = [
  {
    placement: "left",
    noOffset: [50, 200, u, 100, 350],
    offsetBefore: [-200, 50, u, 4, 500],
    offsetAfter: [300, 350, u, 196, 200],
    crossAxisOffsetPositive: [50, 210, u, 90, 340],
    crossAxisOffsetNegative: [50, 190, u, 110, 360],
    mainAxisOffset: [40, 200, u, 100, 350],
    arrowBoundaryOffset: [50, 322, u, 24, 228],
  },
  {
    placement: "left top",
    noOffset: [50, 250, u, 50, 300],
    offsetBefore: [-200, 50, u, 4, 500],
    offsetAfter: [300, 350, u, 196, 200],
    crossAxisOffsetPositive: [50, 260, u, 40, 290],
    crossAxisOffsetNegative: [50, 240, u, 60, 310],
    mainAxisOffset: [40, 250, u, 50, 300],
    arrowBoundaryOffset: [50, 322, u, 24, 228],
  },
  {
    placement: "left bottom",
    noOffset: [50, 150, u, 150, 300],
    offsetBefore: [-200, 50, u, 4, 200],
    offsetAfter: [300, 350, u, 196, 500],
    crossAxisOffsetPositive: [50, 160, u, 140, 310],
    crossAxisOffsetNegative: [50, 140, u, 160, 290],
    mainAxisOffset: [40, 150, u, 150, 300],
    arrowBoundaryOffset: [50, 322, u, 24, 472],
  },
  {
    placement: "top",
    noOffset: [200, 50, 100, u, 200],
    offsetBefore: [50, -200, 4, u, 0],
    offsetAfter: [350, 300, 196, u, 450],
    crossAxisOffsetPositive: [210, 50, 90, u, 200],
    crossAxisOffsetNegative: [190, 50, 110, u, 200],
    mainAxisOffset: [200, 40, 100, u, 190],
    arrowBoundaryOffset: [322, 50, 24, u, 200],
  },
  {
    placement: "top left",
    noOffset: [250, 50, 50, u, 200],
    offsetBefore: [50, -200, 4, u, 0],
    offsetAfter: [350, 300, 196, u, 450],
    crossAxisOffsetPositive: [260, 50, 40, u, 200],
    crossAxisOffsetNegative: [240, 50, 60, u, 200],
    mainAxisOffset: [250, 40, 50, u, 190],
    arrowBoundaryOffset: [322, 50, 24, u, 200],
  },
  {
    placement: "top right",
    noOffset: [150, 50, 150, u, 200],
    offsetBefore: [50, -200, 4, u, 0],
    offsetAfter: [350, 300, 196, u, 450],
    crossAxisOffsetPositive: [160, 50, 140, u, 200],
    crossAxisOffsetNegative: [140, 50, 160, u, 200],
    mainAxisOffset: [150, 40, 150, u, 190],
    arrowBoundaryOffset: [322, 50, 24, u, 200],
  },
  {
    placement: "bottom",
    noOffset: [200, 350, 100, u, 200],
    offsetBefore: [50, 100, 4, u, 450],
    offsetAfter: [350, 600, 196, u, 0],
    crossAxisOffsetPositive: [210, 350, 90, u, 200],
    crossAxisOffsetNegative: [190, 350, 110, u, 200],
    mainAxisOffset: [200, 360, 100, u, 190],
    arrowBoundaryOffset: [322, 350, 24, u, 200],
  },
  {
    placement: "bottom left",
    noOffset: [250, 350, 50, u, 200],
    offsetBefore: [50, 100, 4, u, 450],
    offsetAfter: [350, 600, 196, u, 0],
    crossAxisOffsetPositive: [260, 350, 40, u, 200],
    crossAxisOffsetNegative: [240, 350, 60, u, 200],
    mainAxisOffset: [250, 360, 50, u, 190],
    arrowBoundaryOffset: [322, 350, 24, u, 200],
  },
  {
    placement: "bottom right",
    noOffset: [150, 350, 150, u, 200],
    offsetBefore: [50, 100, 4, u, 450],
    offsetAfter: [350, 600, 196, u, 0],
    crossAxisOffsetPositive: [160, 350, 140, u, 200],
    crossAxisOffsetNegative: [140, 350, 160, u, 200],
    mainAxisOffset: [150, 360, 150, u, 190],
    arrowBoundaryOffset: [322, 350, 24, u, 200],
  },
  {
    placement: "right",
    noOffset: [350, 200, u, 100, 350],
    offsetBefore: [100, 50, u, 4, 500],
    offsetAfter: [600, 350, u, 196, 200],
    crossAxisOffsetPositive: [350, 210, u, 90, 340],
    crossAxisOffsetNegative: [350, 190, u, 110, 360],
    mainAxisOffset: [360, 200, u, 100, 350],
    arrowBoundaryOffset: [350, 322, u, 24, 228],
  },
  {
    placement: "right top",
    noOffset: [350, 250, u, 50, 300],
    offsetBefore: [100, 50, u, 4, 500],
    offsetAfter: [600, 350, u, 196, 200],
    crossAxisOffsetPositive: [350, 260, u, 40, 290],
    crossAxisOffsetNegative: [350, 240, u, 60, 310],
    mainAxisOffset: [360, 250, u, 50, 300],
    arrowBoundaryOffset: [350, 322, u, 24, 228],
  },
  {
    placement: "right bottom",
    noOffset: [350, 150, u, 150, 300],
    offsetBefore: [100, 50, u, 4, 200],
    offsetAfter: [600, 350, u, 196, 500],
    crossAxisOffsetPositive: [350, 160, u, 140, 310],
    crossAxisOffsetNegative: [350, 140, u, 160, 290],
    mainAxisOffset: [360, 150, u, 150, 300],
    arrowBoundaryOffset: [350, 322, u, 24, 472],
  },
];

describe("calculatePosition", () => {
  beforeEach(() => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        offsetTop: 0,
        height: 600,
        offsetLeft: 0,
        scale: 1,
        width: 0,
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent: () => true,
        pageLeft: 0,
        pageTop: 0,
      },
    });
    dom.reset();
  });

  for (const testCase of testCases) {
    const { placement } = testCase;
    const c = testCase as unknown as Record<string, Expected>;
    describe(`placement = ${placement}`, () => {
      describe("no viewport offset", () => {
        checkPosition(placement, getTargetDimension({ left: 250, top: 250 }), c.noOffset!);
        checkPositionForProvider(placement, getTargetDimension({ left: 250, top: 250 }), c.noOffset!);
      });
      describe("viewport offset before", () => {
        checkPosition(placement, getTargetDimension({ left: 0, top: 0 }), c.offsetBefore!);
        checkPositionForProvider(placement, getTargetDimension({ left: 250, top: 250 }), c.noOffset!);
      });
      describe("viewport offset after", () => {
        checkPosition(placement, getTargetDimension({ left: 500, top: 500 }), c.offsetAfter!);
      });
      describe("main axis offset", () => {
        checkPosition(placement, getTargetDimension({ left: 250, top: 250 }), c.mainAxisOffset!, 10, 0);
      });
      describe("cross axis offset positive", () => {
        checkPosition(placement, getTargetDimension({ left: 250, top: 250 }), c.crossAxisOffsetPositive!, 0, 10);
      });
      describe("cross axis offset negative", () => {
        checkPosition(placement, getTargetDimension({ left: 250, top: 250 }), c.crossAxisOffsetNegative!, 0, -10);
      });
      describe("minimum overlay arrow offset", () => {
        checkPosition(placement, getTargetDimension({ left: 250, top: 250 }), c.arrowBoundaryOffset!, 0, 1000, false, undefined, undefined, 20);
      });
    });
  }

  describe("flip from left to right", () => {
    checkPosition("left", getTargetDimension({ left: 0, top: 0 }), (testCases[9] as unknown as Record<string, Expected>).offsetBefore!, 0, 0, true);
    describe("positive offset", () => {
      checkPosition("left", getTargetDimension({ left: 0, top: 250 }), [110, 200, undefined, 100, 350], 10, 0, true);
    });
  });

  describe("overlay smaller than target aligns in center", () => {
    checkPosition("right", getTargetDimension({ left: 250, top: 250 }, overlaySize.height + 100, overlaySize.width + 100), [550, 300, undefined, 100, 250]);
  });

  test("overlay target has margin: checks if overlay positions correctly", () => {
    const target = document.createElement("div");
    const overlayNode = document.createElement("div");
    const container = document.createElement("div");
    target.style.margin = "20px";
    document.body.appendChild(target);
    const {
      position: { top: positionTop },
    } = calculatePosition({
      placement: "bottom",
      overlayNode,
      targetNode: target,
      scrollNode: overlayNode,
      padding: 0,
      shouldFlip: false,
      boundaryElement: container,
      offset: 0,
      crossOffset: 0,
      arrowSize: 0,
    });
    assert.equal(positionTop, 0);
    document.body.removeChild(target);
  });
});
