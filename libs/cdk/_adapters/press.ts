// Press tracking for the tabs handlers (`tabs/behaviour.ts`): which pointer started the press on a
// tab and the owner-keyed long-press timer. Types, modality and virtual-event detection are the
// package's single implementations (`../interactions/press.tsx`, `../interactions/focus-visible.tsx`,
// `../platform`). Ported in spirit from react-spectrum (Apache-2.0, © Adobe):
// interactions/usePress.ts (press start / end bookkeeping), useLongPress.ts (timer).
import type { PointerType } from "../interactions/utils.ts";

export type { PointerType } from "../interactions/utils.ts";
export type { Modality } from "../interactions/focus-visible.tsx";
export { getInteractionModality, setInteractionModality } from "../interactions/focus-visible.tsx";
export { isVirtualClick, isVirtualPointerEvent } from "../platform/index.ts";
export { pressEvent, type PressEvent } from "./interactions.ts";
export { pointerTypeOf } from "../selection/dom-utils.ts";

interface PressTrack {
  pointerType: PointerType;
  target: Element;
  longPressTimer?: ReturnType<typeof setTimeout>;
  longPressed?: boolean;
  key?: string;
}

const tracks = new WeakMap<object, PressTrack>();

/** Start tracking a press on `target` for `owner` (pointer down / key down). */
export function beginPress(owner: object, target: Element, pointerType: PointerType, key?: string): PressTrack {
  const previous = tracks.get(owner);
  if (previous?.longPressTimer) clearTimeout(previous.longPressTimer);
  const track: PressTrack = { pointerType, target, key };
  tracks.set(owner, track);
  return track;
}

/** The press in progress for `owner`, if any. */
export const currentPress = (owner: object): PressTrack | undefined => tracks.get(owner);

/** End the press: returns it (and forgets it). */
export function endPress(owner: object): PressTrack | undefined {
  const track = tracks.get(owner);
  if (track?.longPressTimer) clearTimeout(track.longPressTimer);
  tracks.delete(owner);
  return track;
}

/** Arm a long press (react-aria useLongPress, default threshold 500 ms). */
export function armLongPress(owner: object, onLongPress: () => void, threshold = 500): void {
  const track = tracks.get(owner);
  if (!track) return;
  track.longPressTimer = setTimeout(() => {
    track.longPressed = true;
    onLongPress();
  }, threshold);
}
