// Ported from react-resizable-panels (lib/global/styles/convertEmToPixels.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function convertEmToPixels(element: Element, value: number) {
  const style = getComputedStyle(element);
  const fontSize = parseFloat(style.fontSize);

  return value * fontSize;
}
