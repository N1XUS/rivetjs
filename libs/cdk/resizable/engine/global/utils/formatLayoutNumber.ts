// Ported from react-resizable-panels (lib/global/utils/formatLayoutNumber.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function formatLayoutNumber(number: number) {
  return parseFloat(number.toFixed(3));
}
