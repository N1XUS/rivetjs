// Ported from react-resizable-panels (lib/global/utils/adjustLayoutForSeparator.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { assert } from "../../utils/assert.ts";
import { getMountedAxisState, updateMountedAxis } from "../mutable-state/axes.ts";
import { adjustLayoutByDelta } from "./adjustLayoutByDelta.ts";
import { findSeparatorAxis } from "./findSeparatorAxis.ts";
import { getImperativeAxisMethods } from "./getImperativeAxisMethods.ts";
import { layoutsEqual } from "./layoutsEqual.ts";
import { validateAxisLayout } from "./validateAxisLayout.ts";

export function adjustLayoutForSeparator(separatorElement: HTMLElement, delta: number) {
  const axis = findSeparatorAxis(separatorElement);
  const axisState = getMountedAxisState(axis.id, true);

  const separator = axis.separators.find((current) => current.element === separatorElement);
  assert(separator, "Matching separator not found");

  const items = axisState.separatorToItems.get(separator);
  assert(items, "Matching panels not found");

  const pivotIndices = items.map((item) => axis.items.indexOf(item));

  const axisAPI = getImperativeAxisMethods({ axisId: axis.id });
  const prevLayout = axisAPI.getLayout();

  const unsafeLayout = adjustLayoutByDelta({
    delta,
    initialLayout: prevLayout,
    itemConstraints: axisState.derivedItemConstraints,
    pivotIndices,
    prevLayout,
    trigger: "keyboard",
  });
  const nextLayout = validateAxisLayout({
    layout: unsafeLayout,
    itemConstraints: axisState.derivedItemConstraints,
  });

  if (!layoutsEqual(prevLayout, nextLayout)) {
    updateMountedAxis(
      axis,
      {
        defaultLayoutDeferred: axisState.defaultLayoutDeferred,
        derivedItemConstraints: axisState.derivedItemConstraints,
        axisSize: axisState.axisSize,
        layout: nextLayout,
        requestedAxisSize: axisState.axisSize,
        requestedLayout: nextLayout,
        separatorToItems: axisState.separatorToItems,
      },
      // Keyboard resizes (arrow keys, Home/End, Enter collapse/expand) originate
      // from a real DOM event on the separator, so they are user interactions
      // just like pointer drags. This function is only reached from
      // onDocumentKeyDown. See #716.
      { isUserInteraction: true },
    );
  }
}
