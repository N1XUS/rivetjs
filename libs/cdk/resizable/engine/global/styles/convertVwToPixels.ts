// Ported from react-resizable-panels (lib/global/styles/convertVwToPixels.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function convertVwToPixels(value: number) {
  return (value / 100) * window.innerWidth;
}
