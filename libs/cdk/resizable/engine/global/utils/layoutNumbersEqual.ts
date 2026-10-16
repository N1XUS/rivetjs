// Ported from react-resizable-panels (lib/global/utils/layoutNumbersEqual.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
import { formatLayoutNumber } from "./formatLayoutNumber.ts";

export function layoutNumbersEqual(actual: number, expected: number, minimumDelta = 0) {
  return Math.abs(formatLayoutNumber(actual) - formatLayoutNumber(expected)) <= minimumDelta;
}
