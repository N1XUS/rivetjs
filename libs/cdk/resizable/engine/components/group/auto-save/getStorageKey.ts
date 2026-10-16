// Ported from react-resizable-panels (lib/components/group/auto-save/getStorageKey.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function getStorageKey(id: string, panelIds: string[]): string {
  return `react-resizable-panels:${[id, ...panelIds].join(":")}`;
}
