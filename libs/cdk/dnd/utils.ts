// Ported from react-spectrum (packages/react-aria/src/dnd/utils.ts), Apache-2.0, © Adobe.
// Rivet:
// - The drop half (`DragTypes`, `readFromDataTransfer`, `is*DropItem`, `DIRECTORY_DRAG_TYPE`) is re-exported from
//   `../drop-zone/dnd.ts` (one implementation for DropZone and the collections).
// - `useDragModality` returns an accessor over a module signal the focus-visible change handlers update (React
//   re-renders on `useInteractionModality` changes).
// - `droppableCollectionMap` holds `{ id, ref }` per droppable collection state as upstream; refs are `ElementRef`.
// - `descriptionId(text)`: react-aria `useDescription` for elements rendered in the browser only (drop indicators, the
//   drag button after adoption): one hidden node per distinct text, created on first use and kept (upstream reference
//   counts and removes it with the last user).
import { signal } from "@rivetjs/reactivity";
import { changeHandlers, getInteractionModality, setupGlobalFocusEvents } from "../interactions/focus-visible.tsx";
import { CUSTOM_DRAG_TYPE, DROP_OPERATION, NATIVE_DRAG_TYPES } from "./constants.ts";
import type { DragItem, ElementRef, Key } from "./types.ts";
import type { DroppableCollectionState } from "../state/droppable-collection.ts";

export { DIRECTORY_DRAG_TYPE, DragTypes, readFromDataTransfer, isDirectoryDropItem, isFileDropItem, isTextDropItem } from "../drop-zone/dnd.ts";

interface DroppableCollectionMap {
  id: string;
  ref: ElementRef;
}

export const droppableCollectionMap: WeakMap<DroppableCollectionState, DroppableCollectionMap> = new WeakMap();

export function getDroppableCollectionId(state: DroppableCollectionState): string {
  const { id } = droppableCollectionMap.get(state) || {};
  if (!id) throw new Error("Droppable item outside a droppable collection");
  return id;
}

export function getDroppableCollectionRef(state: DroppableCollectionState): ElementRef {
  const { ref } = droppableCollectionMap.get(state) || {};
  if (!ref) throw new Error("Droppable item outside a droppable collection");
  return ref;
}

export function getTypes(items: DragItem[]): Set<string> {
  const types = new Set<string>();
  for (const item of items) for (const type of Object.keys(item)) types.add(type);
  return types;
}

function mapModality(modality: string | null): "keyboard" | "touch" | "virtual" {
  if (!modality) modality = "virtual";
  if (modality === "pointer") modality = "virtual";
  if (modality === "virtual" && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches)
    modality = "touch";
  return modality as "keyboard" | "touch" | "virtual";
}

// Rivet: the interaction modality as a signal (react-aria `useInteractionModality` state), installed on first read.
const modality = signal<string | null>(null);
let tracking = false;
function trackModality(): void {
  if (tracking || typeof document === "undefined") return;
  tracking = true;
  setupGlobalFocusEvents();
  changeHandlers.add(() => modality.set(getInteractionModality()));
}

/** The drag modality, reactive (react-aria `useDragModality`). */
export function useDragModality(): () => "keyboard" | "touch" | "virtual" {
  return () => {
    trackModality();
    modality();
    return mapModality(getInteractionModality());
  };
}

export function getDragModality(): "keyboard" | "touch" | "virtual" {
  return mapModality(getInteractionModality());
}

export function writeToDataTransfer(dataTransfer: DataTransfer, items: DragItem[]): void {
  // The data transfer API doesn't support more than one item of a given type at once. In addition, only a small set of
  // types are supported natively for transfer between applications. We allow for both multiple items, as well as
  // multiple representations of a single item. In order to make our API work with the native API, we serialize all
  // items to JSON and store as a single native item. We only need to do this if there is more than one item of the
  // same type, or if an item has more than one representation. Otherwise the native API is sufficient.
  //
  // The DataTransferItemList API also theoretically supports adding files, which would enable dragging binary data out
  // of the browser onto the user's desktop for example. Unfortunately, this does not currently work in any browser, so
  // it is not currently supported by our API. See e.g. https://bugs.chromium.org/p/chromium/issues/detail?id=438479.
  const groupedByType = new Map<string, string[]>();
  let needsCustomData = false;
  const customData: Array<Record<string, string>> = [];
  for (const item of items) {
    const types = Object.keys(item);
    if (types.length > 1) needsCustomData = true;
    const dataByType: Record<string, string> = {};
    for (const type of types) {
      let typeItems = groupedByType.get(type);
      if (!typeItems) {
        typeItems = [];
        groupedByType.set(type, typeItems);
      } else needsCustomData = true;
      const data = item[type]!;
      dataByType[type] = data;
      typeItems.push(data);
    }
    customData.push(dataByType);
  }
  for (const [type, items] of groupedByType) {
    // Only one item of a given type can be set on a data transfer: join all of the items together separated by newlines.
    if (NATIVE_DRAG_TYPES.has(type)) dataTransfer.items.add(items.join("\n"), type);
    // Set data to the first item so we have access to the list of types.
    else dataTransfer.items.add(items[0]!, type);
  }
  if (needsCustomData) dataTransfer.items.add(JSON.stringify(customData), CUSTOM_DRAG_TYPE);
}

// Global DnD collection state tracker.
export interface DnDState {
  /** A ref for the of the drag items in the current drag session if any. */
  draggingCollectionRef?: ElementRef | undefined;
  /** The set of currently dragged keys. */
  draggingKeys: Set<Key>;
  /** A ref for the collection that is targeted for a drop operation, if any. */
  dropCollectionRef?: ElementRef | undefined;
}

export let globalDndState: DnDState = { draggingKeys: new Set() };

export function setDraggingCollectionRef(ref: ElementRef): void {
  globalDndState.draggingCollectionRef = ref;
}

export function setDraggingKeys(keys: Set<Key>): void {
  globalDndState.draggingKeys = keys;
}

export function setDropCollectionRef(ref?: ElementRef): void {
  globalDndState.dropCollectionRef = ref;
}

export function clearGlobalDnDState(): void {
  globalDndState = { draggingKeys: new Set() };
}

export function setGlobalDnDState(state: DnDState): void {
  globalDndState = state;
}

// Whether the current dragging collection ref is the same as the current targeted droppable collection ref. Allows a
// droppable ref arg in case the global drop collection ref hasn't been set.
export function isInternalDropOperation(ref?: ElementRef): boolean {
  const { draggingCollectionRef, dropCollectionRef } = globalDndState;
  return draggingCollectionRef?.current != null && draggingCollectionRef.current === (ref?.current || dropCollectionRef?.current);
}

type DropEffect = "none" | "copy" | "link" | "move";
export let globalDropEffect: DropEffect | undefined;
export function setGlobalDropEffect(dropEffect: DropEffect | undefined): void {
  globalDropEffect = dropEffect;
}

export let globalAllowedDropOperations: number = DROP_OPERATION.none;
export function setGlobalAllowedDropOperations(o: number): void {
  globalAllowedDropOperations = o;
}

// --- react-aria useDescription (browser-rendered describers) -----------------------------------------------------

let descriptionCount = 0;
const descriptions = new Map<string, HTMLElement>();

/** The id of a hidden element holding `text` (`aria-describedby`); browser only, `undefined` for no text / on the server. */
export function descriptionId(text: string | undefined): string | undefined {
  if (!text || typeof document === "undefined") return undefined;
  let node = descriptions.get(text);
  if (!node || !node.isConnected) {
    node = document.createElement("div");
    node.id = `rv-dnd-description-${descriptionCount++}`;
    node.style.display = "none";
    node.textContent = text;
    document.body.appendChild(node);
    descriptions.set(text, node);
  }
  return node.id;
}
