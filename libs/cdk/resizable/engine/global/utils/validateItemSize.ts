// Ported from react-resizable-panels (lib/global/utils/validateItemSize.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { compareLayoutNumbers } from "./compareLayoutNumbers.ts";
import { formatLayoutNumber } from "./formatLayoutNumber.ts";
import type { ResizeItemConstraints } from "../types.ts";

// Panel size must be in percentages; pixel values should be pre-converted
export function validateItemSize({
  overrideDisabledItems,
  itemConstraints,
  prevSize,
  size,
}: {
  overrideDisabledItems?: boolean;
  itemConstraints: ResizeItemConstraints;
  prevSize: number;
  size: number;
}) {
  const { collapsedSize = 0, collapsedThreshold, collapsible, disabled, maxSize = 100, minSize = 0 } = itemConstraints;

  if (disabled && !overrideDisabledItems) {
    return prevSize;
  }

  if (compareLayoutNumbers(size, minSize) < 0) {
    if (collapsible) {
      const threshold = collapsedThreshold ?? (minSize - collapsedSize) / 2;
      const wasCollapsed = compareLayoutNumbers(prevSize, collapsedSize) <= 0;
      const boundary = wasCollapsed ? collapsedSize + threshold : minSize - threshold;
      const comparison = compareLayoutNumbers(size, boundary);

      if (compareLayoutNumbers(size, collapsedSize) <= 0 || comparison < 0 || (collapsedThreshold !== undefined && wasCollapsed && comparison === 0)) {
        size = collapsedSize;
      } else {
        size = minSize;
      }
    } else {
      size = minSize;
    }
  }

  size = Math.min(maxSize, size);
  size = formatLayoutNumber(size);

  return size;
}
