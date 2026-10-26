// Press handlers for elements that wire explicit `onX` attributes (Button, Link, ToggleButton, ToggleButtonGroup
// items, Table rows): the `(options, event)` names of THE usePress port's per-element adapter, which lives with the
// press state machine in `../interactions/press.tsx` (react-aria `usePress`, Apache-2.0, © Adobe): press state per
// element (module WeakMap, transient, never serialized), the pressed render state written as `data-pressed="true"`.
// Re-exports only: no code, so no chunk of its own (PRESSSPLIT 2026-10-26: −1 request on every Button / Link page).
export {
  elementCancelPress as cancelPress,
  elementClick as pressClick,
  elementDragStart as pressDragStart,
  elementKeyDown as pressKeyDown,
  elementMouseDown as pressMouseDown,
  elementPointerDown as pressPointerDown,
  elementPointerEnter as pressPointerEnter,
  elementPointerLeave as pressPointerLeave,
  elementPointerUp as pressPointerUp,
  isElementPressed as isPressed,
} from "../interactions/press.tsx";
export type { PointerType, PressEvent, PressEvents, PressProps } from "../interactions/press.tsx";
export { isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";

import type { PressProps } from "../interactions/press.tsx";
/** Press options of the explicit-handler style (react-aria `PressProps`). */
export type PressOptions = PressProps;
