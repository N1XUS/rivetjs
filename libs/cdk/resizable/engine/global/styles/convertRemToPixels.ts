// Ported from react-resizable-panels (lib/global/styles/convertRemToPixels.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function convertRemToPixels(element: Element, value: number) {
  const style = getComputedStyle(element.ownerDocument.documentElement);
  const fontSize = parseFloat(style.fontSize);

  return value * fontSize;
}
