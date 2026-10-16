// Ported from react-resizable-panels (lib/global/utils/findSeparatorAxis.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { getMountedAxes } from "../mutable-state/axes.ts";

export function findSeparatorAxis(separatorElement: HTMLElement) {
  const mountedAxes = getMountedAxes();

  for (const [axis] of mountedAxes) {
    if (axis.separators.some((separator) => separator.element === separatorElement)) {
      return axis;
    }
  }

  throw Error("Could not find parent Group for separator element");
}
