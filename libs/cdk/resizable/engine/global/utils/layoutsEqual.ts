// Ported from react-resizable-panels (lib/global/utils/layoutsEqual.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { compareLayoutNumbers } from "./compareLayoutNumbers.ts";
import type { Layout } from "../types.ts";

export function layoutsEqual(a: Layout, b: Layout): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) {
    return false;
  }

  for (const id in a) {
    // Edge case: Panel id has been changed
    if (b[id] === undefined || compareLayoutNumbers(a[id], b[id]) !== 0) {
      return false;
    }
  }

  return true;
}
