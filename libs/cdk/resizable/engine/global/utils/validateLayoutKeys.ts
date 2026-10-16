// Ported from react-resizable-panels (lib/global/utils/validateLayoutKeys.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { Layout, RegisteredResizeItem } from "../types.ts";

export function validateLayoutKeys(items: RegisteredResizeItem[], layout: Layout) {
  const itemIds = items.map((item) => item.id);
  const layoutKeys = Object.keys(layout);

  if (itemIds.length !== layoutKeys.length) {
    return false;
  }

  for (const itemId of itemIds) {
    if (!layoutKeys.includes(itemId)) {
      return false;
    }
  }

  return true;
}
