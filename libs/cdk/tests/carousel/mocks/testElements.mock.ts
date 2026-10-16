// Ported from embla-carousel (packages/embla-carousel/src/__tests__/mocks/testElements.mock.ts, v8.6.0), MIT, © David Jerleke.
// Changes: Jest globals from `@rivetjs/testing/jest`, module specifiers, `as` casts; `mockTestElements` appends the root to
// `document.body` (happy-dom computes styles of connected elements only).
/*
Get offsets in console to create fixtures
-----------------------------------------

function mapToOffsets({ offsetWidth, offsetHeight, offsetTop, offsetLeft }) {
  return {
    offsetWidth,
    offsetHeight,
    offsetTop,
    offsetLeft
  }
}

[
  mapToOffsets(emblaApi.containerNode()),
  emblaApi.slideNodes().map(mapToOffsets)
]
*/

type TestElementOffsetType = {
  offsetLeft: number;
  offsetTop: number;
  offsetWidth: number;
  offsetHeight: number;
};

export type TestElementDimensionsType = {
  containerOffset?: TestElementOffsetType;
  slideOffsets: TestElementOffsetType[];
  endMargin: {
    property: "marginLeft" | "marginRight" | "marginTop" | "marginBottom";
    value: number;
  };
};

function mockNodeOffsets(node: HTMLElement, offsets: TestElementOffsetType): void {
  const { offsetTop, offsetLeft, offsetWidth, offsetHeight } = offsets;
  Object.defineProperty(node, "offsetTop", { value: offsetTop });
  Object.defineProperty(node, "offsetLeft", { value: offsetLeft });
  Object.defineProperty(node, "offsetWidth", { value: offsetWidth });
  Object.defineProperty(node, "offsetHeight", { value: offsetHeight });
}

export function mockTestElementDimensions(dimensions: TestElementDimensionsType, rootNode: HTMLElement): void {
  const { containerOffset, slideOffsets, endMargin } = dimensions;
  const containerNode = rootNode.children[0] as HTMLElement;
  const slideNodes = slideOffsets.map(() => document.createElement("div"));

  if (!containerOffset) return;

  containerNode.innerHTML = "";
  slideNodes.forEach((slideNode) => containerNode.appendChild(slideNode));

  mockNodeOffsets(rootNode, containerOffset);
  mockNodeOffsets(containerNode, containerOffset);
  slideNodes.forEach((s, i) => mockNodeOffsets(s, slideOffsets[i]));

  if (!slideNodes.length) return;

  const lastSlide = slideNodes[slideNodes.length - 1];
  lastSlide.style[endMargin.property] = `${endMargin.value}px`;
}

export function mockTestElements(dimensions: TestElementDimensionsType): HTMLElement {
  const { containerOffset } = dimensions;
  const rootNode = document.createElement("div");
  const containerNode = document.createElement("div");

  if (containerOffset) {
    rootNode.appendChild(containerNode);
    mockTestElementDimensions(dimensions, rootNode);
  }

  // Rivet: happy-dom computes styles of connected elements only (jsdom also of detached ones): the engine reads
  // the last slide's end margin through `getComputedStyle`.
  document.body.appendChild(rootNode);
  return rootNode;
}
