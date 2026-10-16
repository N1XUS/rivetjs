// Ported from react-resizable-panels (lib/global/dom/calculateAvailableAxisSize.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { RegisteredResizeAxis } from "../types.ts";

export function calculateAvailableAxisSize({ axis }: { axis: RegisteredResizeAxis }) {
  const { layoutStrategy, orientation, items } = axis;

  if (layoutStrategy) {
    return layoutStrategy.calculateAvailableSize();
  }

  return items.reduce((totalSize, item) => {
    totalSize += orientation === "horizontal" ? item.element.offsetWidth : item.element.offsetHeight;
    return totalSize;
  }, 0);
}
