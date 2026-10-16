// Ported from react-resizable-panels (lib/global/utils/itemConstraintsEqual.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { objectsEqual } from "./objectsEqual.ts";
import type { ResizeItemConstraints } from "../types.ts";

export function itemConstraintsEqual(a: ResizeItemConstraints[], b: ResizeItemConstraints[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((current, index) => objectsEqual(current, b[index]));
}
