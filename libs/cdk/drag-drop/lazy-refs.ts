// Rivet: the handlers of the drag-drop components (drag.tsx, drop-list.tsx) and the public instance
// lookups. A component element's handler creates its directive instance (directives/*.ts) from the
// props it captured — on a resumed page that happens on the first press (or the wake event, see
// directives/registry.ts), on a client-rendered one too, so both paths are the same.
//
// Cold presses: the loader replays a `mousedown` / `touchstart` once the component chunks are in
// (async). The replayed event is forwarded with its age: the ref counts the drag-start delay from the
// original press and cancels the pending sequence when the press was released meanwhile
// (`DragRef._pointerDownFromHost`). An item whose `<DropList>` chunk is still loading waits for the
// list to register before it handles the press (so it never starts in standalone mode).
import { DragInstance, type DragSetup } from "./directives/drag.ts";
import { DropListInstance, type DropListSetup } from "./directives/drop-list.ts";
import { DRAG_ATTR, closestDropListElement, dragOf, dropListOf, drags, dropLists, isWake, wake, whenRegistered } from "./directives/registry.ts";
import { handleElements } from "./directives/drag-handle.ts";
import { toggleNativeDragInteractions } from "./dom/styling.ts";

/** A press handled this much later than it happened (ms) was replayed after its code loaded. */
const REPLAYED_AFTER = 50;

/** Handler of a `<Drag>` element (`mousedown`, `touchstart`, `dragstart` + the wake event). */
export function dragHostEvent<T>(event: Event, setup: DragSetup<T>): void {
  const element = event.currentTarget as HTMLElement;
  // The item's list must exist first: the item joins it while being created.
  const list = closestDropListElement(element);
  if (list && !dropLists.has(list)) {
    wake(list);
    if (!dropLists.has(list)) {
      if (!isWake(event) && event.type !== "dragstart")
        whenRegistered(
          list,
          () => dropLists.has(list),
          () => dragHostEvent(event, setup),
        );
      return;
    }
  }
  const instance = drags.get(element) as DragInstance<T> | undefined;
  if (instance) instance._setInputs(setup);
  const drag = instance ?? new DragInstance<T>(element, setup);
  // The wake event, or a native `dragstart`: the ref's own listener prevents it when needed, except
  // for the `dragstart` that created the ref (its listener was added during the dispatch).
  if (event.type === "dragstart") {
    if (!instance && !isWake(event)) drag._dragRef._nativeDragStartFromHost(event as DragEvent);
    return;
  }
  drag._beforePointerDown();
  const age = performance.now() - event.timeStamp;
  drag._dragRef._pointerDownFromHost(event as MouseEvent | TouchEvent, age > REPLAYED_AFTER ? age : 0);
}

/** Handler of a `<DropList>` element (`mousedown`, `touchstart` and the wake event): creates its instance. */
export function dropListHostEvent<T>(event: Event, setup: DropListSetup<T>): void {
  const element = event.currentTarget as HTMLElement;
  const instance = dropLists.get(element) as DropListInstance<T> | undefined;
  if (instance) instance._setInputs(setup);
  else new DropListInstance<T>(element, setup);
}

/**
 * The `Drag` instance of a `<Drag>` element (Angular: the `CdkDrag` directive instance, e.g. from
 * `@ViewChild(CdkDrag)`), created on first use. `null` while the element's code is still loading on
 * a resumed page (it then registers on its own) or when `element` is not a `<Drag>`.
 */
export function dragInstance<T = any>(element: Element): DragInstance<T> | null {
  return dragOf(element) as DragInstance<T> | null;
}

/** The `DropList` instance of a `<DropList>` element, created on first use (see `dragInstance`). */
export function dropListInstance<T = any>(element: Element): DropListInstance<T> | null {
  return dropListOf(element) as DropListInstance<T> | null;
}

/** Mounted (client-rendered) `<Drag>`: join a list that is being dragged over right away (Angular `addItem`). */
export function dragMounted(element: HTMLElement): void {
  const list = element.isConnected ? closestDropListElement(element) : null;
  const instance = list ? dropLists.get(list) : undefined;
  if (instance && (instance._dropListRef.isDragging() || instance._dropListRef.isReceiving())) dragOf(element);
}

/** Removed client-rendered `<Drag>` (Angular `ngOnDestroy`). */
export function dragDestroyed(element: HTMLElement): void {
  drags.get(element)?.destroy();
}

/** Removed client-rendered `<DropList>` (Angular `ngOnDestroy`). */
export function dropListDestroyed(element: HTMLElement): void {
  dropLists.get(element)?.destroy();
}

/** Drag elements (refs: set once rendered) with an alternate root and no instance yet, per document. */
const watchedRoots = new Map<() => HTMLElement | undefined, () => string | undefined>();
let rootListener = false;

/** Client-rendered `<Drag>` with `rootElementSelector`: a press inside its root creates the instance. */
export function watchRoot(element: () => HTMLElement | undefined, selector: () => string | undefined): void {
  watchedRoots.set(element, selector);
  if (rootListener) return;
  rootListener = true;
  // Capturing on the document runs before the press reaches the root, so the ref's root listener
  // (added while the instance is created) still sees this very event.
  const wakeRoots = (event: Event) => {
    const target = event.target as Node | null;
    watchedRoots.forEach((selectorOf, get) => {
      const el = get();
      if (!el) return;
      if (!el.isConnected || drags.has(el)) {
        if (drags.has(el)) watchedRoots.delete(get);
        return;
      }
      const selector = selectorOf();
      const root = selector ? el.closest(selector) : null;
      if (!root || !target || !root.contains(target)) return;
      // The ref listens on its root from creation on (`withRootElement`); handles are synced first,
      // like the drag element's own handler does.
      const instance = dragOf(el);
      if (!instance) return;
      watchedRoots.delete(get);
      instance._beforePointerDown();
    });
  };
  document.addEventListener("mousedown", wakeRoots, true);
  document.addEventListener("touchstart", wakeRoots, { capture: true, passive: true });
}

/** `toggleNativeDragInteractions` on a drag's handles for its disabled state (before its ref exists). */
export function syncHandleInteractions(element: HTMLElement, dragDisabled: boolean): void {
  for (const handle of handleElements(element, DRAG_ATTR)) toggleNativeDragInteractions(handle, dragDisabled || handle.hasAttribute("data-disabled"));
}

/** The `<Drag>` element a handle belongs to. */
export function handleOwner(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>("[data-rv-drag]");
}

/** A client-rendered `<DragHandle>` appeared / went away / changed: re-sync its drag item's handles. */
export function handleChanged(dragElement: HTMLElement | null): void {
  const instance = dragElement ? drags.get(dragElement) : undefined;
  instance?._syncHandles();
}
