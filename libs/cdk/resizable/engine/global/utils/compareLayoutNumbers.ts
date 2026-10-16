// Ported from react-resizable-panels (lib/global/utils/compareLayoutNumbers.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { layoutNumbersEqual } from "./layoutNumbersEqual.ts";

export function compareLayoutNumbers(actual: number, expected: number) {
  if (layoutNumbersEqual(actual, expected)) {
    return 0;
  } else {
    return actual > expected ? 1 : -1;
  }
}
