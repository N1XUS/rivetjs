// Ported from react-resizable-panels (lib/global/utils/isModal.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function isModal(element: Element) {
  try {
    return element.matches(":modal");
  } catch {
    // The ":modal" pseudo-class is not supported by all environments (e.g. older browsers, JSDom)
    return false;
  }
}
