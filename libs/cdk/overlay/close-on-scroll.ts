// The close function an overlay trigger shares with `overlayPosition`, keyed by the trigger
// element (React Aria's `onCloseMap`): scrolling a scroll parent of the trigger closes the overlay
// without passing `onClose` to the positioning. Tiny on purpose (imported by both sides).
//
// Ported from @react-aria/overlays (useCloseOnScroll.ts), Apache-2.0, © Adobe.
export const onCloseMap: WeakMap<Element, () => void> = new WeakMap();
