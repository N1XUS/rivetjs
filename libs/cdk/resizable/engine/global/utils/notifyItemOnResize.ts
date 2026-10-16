// Ported from react-resizable-panels (lib/global/utils/notifyItemOnResize.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { calculateAvailableAxisSize } from "../dom/calculateAvailableAxisSize.ts";
import type { RegisteredResizeAxis } from "../types.ts";
import { formatLayoutNumber } from "./formatLayoutNumber.ts";

export function notifyItemOnResize(axis: RegisteredResizeAxis, element: HTMLElement, borderBoxSize: readonly ResizeObserverSize[]) {
  const resizeObserverSize = borderBoxSize[0];
  if (!resizeObserverSize) {
    return;
  }

  const item = axis.items.find((current) => current.element === element);
  if (!item || !item.onResize) {
    return;
  }

  const axisSize = calculateAvailableAxisSize({ axis });

  const itemSize = axis.orientation === "horizontal" ? item.element.offsetWidth : item.element.offsetHeight;

  const prevSize = item.mutableValues.prevSize;
  const nextSize = {
    asPercentage: formatLayoutNumber((itemSize / axisSize) * 100),
    inPixels: itemSize,
  };
  item.mutableValues.prevSize = nextSize;

  item.onResize(nextSize, item.id, prevSize);
}
