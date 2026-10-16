// Ported from react-resizable-panels (lib/global/utils/getDefaultLayout.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { calculateDefaultLayout } from "./calculateDefaultLayout.ts";
import { validateLayoutKeys } from "./validateLayoutKeys.ts";
import type { Layout, RegisteredResizeAxis, ResizeItemConstraints } from "../types.ts";

export function getDefaultLayout({ axis, itemConstraints }: { axis: RegisteredResizeAxis; itemConstraints: ResizeItemConstraints[] }): Layout {
  const itemIdsKey = axis.items.map(({ id }) => id).join(",");
  const defaultLayout = axis.mutableState.defaultLayout;

  // Dynamic panel configurations can invalidate a supplied default layout.
  return (
    axis.mutableState.layouts[itemIdsKey] ??
    (defaultLayout && validateLayoutKeys(axis.items, defaultLayout) ? defaultLayout : calculateDefaultLayout(itemConstraints))
  );
}
