// Ported from react-resizable-panels (lib/global/utils/normalizeLayout.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { Layout } from "../types.ts";
import { validateAxisLayout } from "./validateAxisLayout.ts";

/**
 * Scales a layout so that its sizes total 100% (rounded the same way as validateAxisLayout),
 * without applying item constraints.
 *
 * @param itemIds Ids in render order; determines which item absorbs rounding errors
 */
export function normalizeLayout({ itemIds, layout }: { itemIds: string[]; layout: Layout }): Layout {
  return validateAxisLayout({
    layout,
    itemConstraints: itemIds.map((itemId) => ({
      collapsedSize: 0,
      collapsible: false,
      defaultSize: undefined,
      disabled: undefined,
      itemId,
      maxSize: 100,
      minSize: 0,
    })),
  });
}
