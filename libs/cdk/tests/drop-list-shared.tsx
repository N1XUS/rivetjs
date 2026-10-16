// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-shared.spec.ts), MIT, © Google LLC.
// Changes: upstream `defineCommonDropListTests` split over two files for size — drop-list-shared-a.tsx
// ("in a drop container") and drop-list-shared-b.tsx ("in a connected drop container", "with nested
// drags", "with an alternate element container", "with an anchor"); fixtures, `ITEM_HEIGHT` /
// `ITEM_WIDTH`, `getHorizontalFixtures`, `assertStartToEndSorting` / `assertEndToStartSorting` live in
// drop-list-fixtures.tsx. Run by drop-list-single-axis / drop-list-mixed `.browser.test.tsx`.
import type { DropListOrientation } from "../drag-drop/index.tsx";
import { defineCommonDropListTestsA } from "./drop-list-shared-a.tsx";
import { defineCommonDropListTestsB } from "./drop-list-shared-b.tsx";

export * from "./drop-list-fixtures.tsx";

/** Function that can be used to get the sorted siblings of an element. */
export type SortedSiblingsFunction = (element: Element, direction: "top" | "left") => Element[];

export interface CommonDropListTestsConfig {
  /** Orientation value that will be passed to tests checking vertical orientation. */
  verticalListOrientation: Exclude<DropListOrientation, "horizontal">;

  /** Orientation value that will be passed to tests checking horizontal orientation. */
  horizontalListOrientation: Exclude<DropListOrientation, "vertical">;

  /** Gets the siblings of an element, sorted by their visible position. */
  getSortedSiblings: SortedSiblingsFunction;
}

export function defineCommonDropListTests(config: CommonDropListTestsConfig) {
  defineCommonDropListTestsA(config);
  defineCommonDropListTestsB(config);
}
