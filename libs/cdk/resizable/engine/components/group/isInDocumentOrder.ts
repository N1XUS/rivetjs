// Ported from react-resizable-panels (lib/components/group/isInDocumentOrder.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { compareDocumentPosition } from "./compareDocumentPosition.ts";

/**
 * Checks whether the elements are (still) in DOM order.
 *
 * This only compares adjacent elements (N-1 comparisons) and does not read layout,
 * so it is cheap enough to run on every render.
 * Disconnected elements are treated as being in order.
 */
export function isInDocumentOrder(elements: HTMLElement[]): boolean {
  for (let index = 1; index < elements.length; index++) {
    if (compareDocumentPosition(elements[index - 1], elements[index]) > 0) {
      return false;
    }
  }

  return true;
}
