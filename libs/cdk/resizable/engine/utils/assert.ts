// Ported from react-resizable-panels (lib/utils/assert.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function assert(expectedCondition: unknown, message: string = "Assertion error"): asserts expectedCondition {
  if (!expectedCondition) {
    throw Error(message);
  }
}
