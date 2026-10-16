// Ported from react-resizable-panels (lib/utils/isShadowRoot.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
// Detects ShadowRoot without requiring instanceof and browser globals
export function isShadowRoot(value: unknown): value is ShadowRoot {
  return value !== null && typeof value === "object" && "nodeType" in value && value.nodeType === Node.DOCUMENT_FRAGMENT_NODE;
}
