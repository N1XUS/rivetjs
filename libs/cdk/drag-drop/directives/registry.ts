// Rivet: browser-side lookup of the directive instances behind server-rendered (or client-rendered)
// `<Drag>` / `<DropList>` / `<DropListGroup>` elements. Angular creates every directive when its view
// is created; a resumed Rivet page runs no component code, so instances are created on demand:
//
// - an element's own handler creates its instance from the props it captured (`dragHostEvent`,
//   `dropListHostEvent` in lazy-refs.ts) — a real `mousedown` / `touchstart`, or the wake event below;
// - code that needs the instance of another element (a connected list, `dragInstance(el)`) dispatches
//   the wake event on it: a non-bubbling `dragstart` CustomEvent marked with `WAKE`. Its resumed
//   handler runs synchronously when its chunk is loaded (the components preload when visible), else
//   the loader replays it once the chunk is in (`whenRegistered` waits for that).
// Instances live in WeakMaps keyed by element: never serialized, gone with the element.
import type { DragInstance } from "./drag.ts";
import type { DropListInstance } from "./drop-list.ts";
import type { DropListGroupInstance } from "./drop-list-group.ts";

/** Marker of the wake event (`CustomEvent.detail`). */
export const WAKE = "rv-drag-drop-wake";

/** Structure attributes rendered by the components (also read by the instances). */
export const DRAG_ATTR = "data-rv-drag";
export const DROP_LIST_ATTR = "data-rv-drop-list";
export const DROP_LIST_GROUP_ATTR = "data-rv-drop-list-group";
export const HANDLE_ATTR = "data-rv-drag-handle";
export const PREVIEW_ATTR = "data-rv-drag-preview";
export const PLACEHOLDER_ATTR = "data-rv-drag-placeholder";

export const drags = new WeakMap<Element, DragInstance>();
export const dropLists = new WeakMap<Element, DropListInstance>();
export const groups = new WeakMap<Element, DropListGroupInstance>();

/**
 * The `<DropList>` element handlers (`lazy-refs.ts` sets them when it evaluates, BIG-UI): `drop-list.tsx` reaches the
 * instance code through here, not through a static import, so a page whose lists hold no `<Drag>` (a scheduler's
 * external-drop hit area, a list not rendered at all) ships none of it. Whatever needs a list's instance (an item's
 * press or wake, `dropListInstance`, a connected list) imports `lazy-refs.ts` statically, so the handlers are set by then;
 * before that a list's own press creates nothing (no instance is needed yet: the item's press or wake creates it).
 */
export const listHost: {
  event?: (event: Event, setup: never) => void;
  destroyed?: (element: HTMLElement) => void;
} = {};

/** Callbacks waiting for an element's instance (a wake replayed after its chunk loaded). */
const waiting = new WeakMap<Element, Array<() => void>>();

/** Whether `event` is the wake event (not a native `dragstart`). */
export const isWake = (event: Event): boolean => (event as CustomEvent).detail === WAKE;

/** Dispatch the wake event on a component element: its handler registers its instance. */
export function wake(element: Element): void {
  element.dispatchEvent(new CustomEvent("dragstart", { detail: WAKE, cancelable: true }));
}

/** Called by the instances once registered: run the waiters. */
export function registered(element: Element): void {
  const callbacks = waiting.get(element);
  if (!callbacks) return;
  waiting.delete(element);
  callbacks.forEach((callback) => callback());
}

/** Run `callback` once `element`'s instance registers (now if it already has). */
export function whenRegistered(element: Element, has: () => boolean, callback: () => void): void {
  if (has()) return callback();
  const callbacks = waiting.get(element);
  if (callbacks) callbacks.push(callback);
  else waiting.set(element, [callback]);
}

/** The `<DropList>` element `element` belongs to (Angular: `CDK_DROP_LIST`, skipSelf), if any. */
export function closestDropListElement(element: Element): Element | null {
  return element.parentElement?.closest(`[${DROP_LIST_ATTR}]`) ?? null;
}

/** The instance of a `<DropList>` element, woken if needed (`null` while its chunk loads). */
export function dropListOf(element: Element): DropListInstance | null {
  let instance = dropLists.get(element);
  if (!instance) {
    wake(element);
    instance = dropLists.get(element);
  }
  return instance ?? null;
}

/** The instance of a `<Drag>` element, woken if needed (`null` while its chunk loads). */
export function dragOf(element: Element): DragInstance | null {
  let instance = drags.get(element);
  if (!instance) {
    wake(element);
    instance = drags.get(element);
  }
  return instance ?? null;
}

/** Reads a plain value or an accessor / signal (`MaybeAccessor`). */
export type MaybeAccessor<T> = T | (() => T);
export const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);
