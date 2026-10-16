// Ported from react-resizable-panels (lib/global/utils/calculateDefaultLayout.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { formatLayoutNumber } from "./formatLayoutNumber.ts";
import type { Layout, ResizeItemConstraints } from "../types.ts";

export function calculateDefaultLayout(derivedItemConstraints: ResizeItemConstraints[]): Layout {
  let explicitCount = 0;
  let total = 0;

  const layout: Layout = {};

  for (const current of derivedItemConstraints) {
    if (current.defaultSize !== undefined) {
      explicitCount++;

      const size = formatLayoutNumber(current.defaultSize);

      total += size;
      layout[current.itemId] = size;
    } else {
      // @ts-expect-error Add panel keys in order to simplify traversal elsewhere; we'll fill them in in the loop below
      layout[current.itemId] = undefined;
    }
  }

  const remainingItemCount = derivedItemConstraints.length - explicitCount;
  if (remainingItemCount !== 0) {
    const size = formatLayoutNumber((100 - total) / remainingItemCount);

    for (const current of derivedItemConstraints) {
      if (current.defaultSize === undefined) {
        layout[current.itemId] = size;
      }
    }
  }

  return layout;
}
