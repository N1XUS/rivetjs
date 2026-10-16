// Ported from react-resizable-panels (lib/global/test/mockPointerEvent.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`).
export function mockPointerEvent({
  clientX = 0,
  clientY = 0,
  type = "pointermove",
}: {
  clientX?: number;
  clientY?: number;
  type?: PointerEvent["type"];
} = {}) {
  return {
    clientX,
    clientY,
    type,
  } as PointerEvent;
}
