// Ported from react-resizable-panels (lib/global/utils/getImperativeAxisMethods.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import type { GroupImperativeHandle } from "../../components/group/types.ts";
import { getMountedAxes, updateMountedAxis } from "../mutable-state/axes.ts";
import type { Layout } from "../types.ts";
import { layoutsEqual } from "./layoutsEqual.ts";
import { validateAxisLayout } from "./validateAxisLayout.ts";

export function getImperativeAxisMethods({ axisId }: { axisId: string }): GroupImperativeHandle {
  const find = () => {
    const mountedAxes = getMountedAxes();
    for (const [axis, value] of mountedAxes) {
      if (axis.id === axisId) {
        return { axis, ...value };
      }
    }

    throw Error(`Could not find Group with id "${axisId}"`);
  };

  return {
    getLayout() {
      const { defaultLayoutDeferred, layout } = find();

      if (defaultLayoutDeferred) {
        // This indicates that the Group has not finished mounting yet
        // Likely because it has been rendered inside of a hidden DOM subtree
        // Any layout value will not have been validated and so it should not be returned
        return {};
      }

      return layout;
    },
    setLayout(unsafeLayout: Layout) {
      const { defaultLayoutDeferred, derivedItemConstraints, axis, axisSize, layout: prevLayout, separatorToItems } = find();

      const nextLayout = validateAxisLayout({
        layout: unsafeLayout,
        itemConstraints: derivedItemConstraints,
      });

      if (defaultLayoutDeferred) {
        // This indicates that the Group has not finished mounting yet
        // Likely because it has been rendered inside of a hidden DOM subtree
        // In this case we cannot fully validate the layout, so we shouldn't apply it
        // It's okay to run the validate function above though,
        // it will still warn about certain types of errors (e.g. wrong number of panels)
        return prevLayout;
      }

      if (!layoutsEqual(prevLayout, nextLayout)) {
        updateMountedAxis(axis, {
          defaultLayoutDeferred,
          derivedItemConstraints,
          axisSize,
          layout: nextLayout,
          requestedAxisSize: axisSize,
          requestedLayout: nextLayout,
          separatorToItems,
        });
      }

      return nextLayout;
    },
  };
}
