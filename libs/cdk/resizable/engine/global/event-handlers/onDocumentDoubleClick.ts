// Ported from react-resizable-panels (lib/global/event-handlers/onDocumentDoubleClick.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { getMountedAxes } from "../mutable-state/axes.ts";
import { findMatchingHitRegions } from "../utils/findMatchingHitRegions.ts";
import { getImperativeItemMethods } from "../utils/getImperativeItemMethods.ts";

export function onDocumentDoubleClick(event: MouseEvent) {
  if (event.defaultPrevented) {
    return;
  }

  const mountedAxes = getMountedAxes();
  const hitRegions = findMatchingHitRegions(event, mountedAxes);
  hitRegions.forEach((current) => {
    if (current.separator && !current.separator.disableDoubleClick) {
      const itemWithDefaultSize = current.items.find((item) => item.constraintProps.defaultSize !== undefined);
      if (itemWithDefaultSize) {
        const defaultSize = itemWithDefaultSize.constraintProps.defaultSize;
        const api = getImperativeItemMethods({
          axisId: current.axis.id,
          itemId: itemWithDefaultSize.id,
        });
        if (api && defaultSize !== undefined) {
          api.resize(defaultSize);

          event.preventDefault();
        }
      }
    }
  });
}
