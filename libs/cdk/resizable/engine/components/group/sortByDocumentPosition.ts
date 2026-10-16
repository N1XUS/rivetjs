// Ported from react-resizable-panels (lib/components/group/sortByDocumentPosition.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { compareDocumentPosition } from "./compareDocumentPosition.ts";

/**
 * Returns a copy of the elements sorted by their position in the DOM.
 */
export function sortByDocumentPosition(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(elements).sort(compareDocumentPosition);
}
