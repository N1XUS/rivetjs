// Ported from react-aria `dnd/constants.ts`, `dnd/utils.ts` (drop half) and `dnd/useDrop.ts` (native drag events), react-spectrum
// packages/react-aria/src/dnd (Apache-2.0, © Adobe), with the drop item types of @react-types/shared.
// Rivet:
// - `useDrop` becomes plain handler functions over a per-element state (`WeakMap`, transient, never serialized):
//   the component binds `dropDragEnter` / `dropDragOver` / `dropDragLeave` / `dropDrop` as its own JSX handlers, so
//   nothing runs before the first drag event on a resumed page. `setDropTarget` = the component's attribute / signal
//   writer.
// - Not ported yet (DnD lane): the keyboard / screen reader drag session (`DragManager`, `useVirtualDrop`,
//   `registerDropTarget`, `onDropActivate` from a virtual drag), the drag source half (`writeToDataTransfer`,
//   `useDrag`, global dragging-collection state). `globalAllowedDropOperations` is `none` (no in-page Rivet drag
//   source sets it yet), so `getAllowedOperations` reads `effectAllowed` + the platform modifier keys only.
import { isIPad, isMac } from "../platform/index.ts";
import { getEventTarget, nodeContains } from "../utils/dom-core.ts";

export type DropOperation = "copy" | "link" | "move" | "cancel";
export type DragType = string | symbol;

/** The drag types of a drag (RA `DragTypes`): `has("image/*")`, `has(DIRECTORY_DRAG_TYPE)`, … */
export interface DragTypesLike {
  has(type: DragType | DragType[]): boolean;
}

export interface TextDropItem {
  kind: "text";
  /** The drag types available for this item. These are often mime types, but may be custom app-specific types. */
  types: Set<string>;
  /** Returns the data for the given type as a string. */
  getText(type: string): Promise<string>;
}

export interface FileDropItem {
  kind: "file";
  /** The file type (usually a mime type). */
  type: string;
  /** The file name. */
  name: string;
  /** Returns the contents of the file as a blob. */
  getFile(): Promise<File>;
  /** Returns the contents of the file as a string. */
  getText(): Promise<string>;
}

export interface DirectoryDropItem {
  kind: "directory";
  /** The directory name. */
  name: string;
  /** Returns the entries contained within the directory. */
  getEntries(): AsyncIterable<FileDropItem | DirectoryDropItem>;
}

export type DropItem = TextDropItem | FileDropItem | DirectoryDropItem;

interface DropPosition {
  /** The x coordinate of the event, relative to the target element. */
  x: number;
  /** The y coordinate of the event, relative to the target element. */
  y: number;
}
export interface DropEnterEvent extends DropPosition {
  type: "dropenter";
}
export interface DropMoveEvent extends DropPosition {
  type: "dropmove";
}
export interface DropActivateEvent extends DropPosition {
  type: "dropactivate";
}
export interface DropExitEvent extends DropPosition {
  type: "dropexit";
}
export interface DropEvent extends DropPosition {
  type: "drop";
  /** The drop operation that should occur. */
  dropOperation: DropOperation;
  /** The dropped items. */
  items: DropItem[];
}

export interface DropOptions {
  /** The drop operation for items matching the given types (RA `getDropOperation`). */
  getDropOperation?: (types: DragTypesLike, allowedOperations: DropOperation[]) => DropOperation;
  /** The drop operation for a specific point within the target (RA `getDropOperationForPoint`). */
  getDropOperationForPoint?: (types: DragTypesLike, allowedOperations: DropOperation[], x: number, y: number) => DropOperation;
  /** Called when a valid drag enters the drop target. */
  onDropEnter?: (e: DropEnterEvent) => void;
  /** Called when a valid drag is moved within the drop target. */
  onDropMove?: (e: DropMoveEvent) => void;
  /** Called after a valid drag is held over the drop target for a period of time. */
  onDropActivate?: (e: DropActivateEvent) => void;
  /** Called when a valid drag exits the drop target. */
  onDropExit?: (e: DropExitEvent) => void;
  /** Called when a valid drag is dropped on the drop target. */
  onDrop?: (e: DropEvent) => void;
}

// --- constants.ts ------------------------------------------------------------------------------

const OP = { none: 0, move: 1, copy: 2, link: 4, all: 7 } as const;
const DROP_OPERATION: Record<DropOperation | "none" | "all", number> = { none: 0, cancel: 0, move: OP.move, copy: OP.copy, link: OP.link, all: OP.all };
// https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/effectAllowed
const DROP_OPERATION_ALLOWED: Record<string, number> = {
  ...DROP_OPERATION,
  copyMove: OP.copy | OP.move,
  copyLink: OP.copy | OP.link,
  linkMove: OP.link | OP.move,
  all: OP.all,
  uninitialized: OP.all,
};
type DropEffect = "none" | "link" | "copy" | "move";
const DROP_EFFECT_TO_DROP_OPERATION: Record<DropEffect, DropOperation> = { none: "cancel", link: "link", copy: "copy", move: "move" };
const DROP_OPERATION_TO_DROP_EFFECT: Record<DropOperation, DropEffect> = { cancel: "none", link: "link", copy: "copy", move: "move" };
const CUSTOM_DRAG_TYPE = "application/vnd.react-aria.items+json";
const GENERIC_TYPE = "application/octet-stream";

/** The drag type of a dropped directory (RA `DIRECTORY_DRAG_TYPE`). */
export const DIRECTORY_DRAG_TYPE: symbol = Symbol();

// --- utils.ts (drop half) ----------------------------------------------------------------------

/** RA `DragTypes`: the types of a native drag. */
export class DragTypes implements DragTypesLike {
  private types: Set<string>;
  private includesUnknownTypes: boolean;

  constructor(dataTransfer: DataTransfer) {
    this.types = new Set<string>();
    let hasFiles = false;
    for (const item of dataTransfer.items) {
      if (item.type !== CUSTOM_DRAG_TYPE) {
        if (item.kind === "file") hasFiles = true;
        // Files with unknown types or extensions are sometimes exposed with an empty type: map to a generic mime
        // type (this could also be a directory: no way to tell until drop).
        if (item.type) this.types.add(item.type);
        else this.types.add(GENERIC_TYPE);
      }
    }
    // Safari: dragging files leaves `items` empty while `types` contains "Files"; assume any checked type is there.
    this.includesUnknownTypes = !hasFiles && dataTransfer.types.includes("Files");
  }

  has(type: DragType | DragType[]): boolean {
    if (Array.isArray(type)) return type.some((t) => this.has(t));
    if (this.includesUnknownTypes || (type === DIRECTORY_DRAG_TYPE && this.types.has(GENERIC_TYPE)) || type === "*/*") return true;
    if (typeof type === "string") {
      if (type.endsWith("/*")) {
        for (const key of this.types) if (key.startsWith(type.slice(0, -2))) return true;
        return false;
      }
      return this.types.has(type);
    }
    return false;
  }
}

/** RA `readFromDataTransfer`: the drop items of a native drag / paste (read during the event). */
export function readFromDataTransfer(dataTransfer: DataTransfer | null | undefined): DropItem[] {
  const items: DropItem[] = [];
  if (!dataTransfer) return items;
  // Our custom drag type, when present: a JSON representation of all items of the drag.
  let hasCustomType = false;
  if (dataTransfer.types.includes(CUSTOM_DRAG_TYPE)) {
    try {
      const parsed = JSON.parse(dataTransfer.getData(CUSTOM_DRAG_TYPE)) as Record<string, string>[];
      for (const item of parsed) items.push({ kind: "text", types: new Set(Object.keys(item)), getText: (type) => Promise.resolve(item[type]!) });
      hasCustomType = true;
    } catch {
      // ignore
    }
  }
  if (!hasCustomType) {
    const stringItems = new Map<string, string>();
    for (const item of dataTransfer.items) {
      if (item.kind === "string") {
        // Read every format now: the data transfer is cleared after the event handler.
        stringItems.set(item.type || GENERIC_TYPE, dataTransfer.getData(item.type));
      } else if (item.kind === "file") {
        if (typeof item.webkitGetAsEntry === "function") {
          const entry = item.webkitGetAsEntry();
          // Firefox: a pasted file / directory can come with an extra item whose entry is null (bug 1699743): skip it.
          if (!entry) continue;
          if (entry.isFile) items.push(createFileItem(item.getAsFile()));
          else if (entry.isDirectory) items.push(createDirectoryItem(entry as FileSystemDirectoryEntry));
        } else items.push(createFileItem(item.getAsFile()));
      }
    }
    // All string items are representations of the same item.
    if (stringItems.size > 0) items.push({ kind: "text", types: new Set(stringItems.keys()), getText: (type) => Promise.resolve(stringItems.get(type)!) });
  }
  return items;
}

function blobToString(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

function createFileItem(file: File | null): FileDropItem {
  if (!file) throw new Error("No file provided");
  return { kind: "file", type: file.type || GENERIC_TYPE, name: file.name, getText: () => blobToString(file), getFile: () => Promise.resolve(file) };
}

function createDirectoryItem(entry: FileSystemDirectoryEntry): DirectoryDropItem {
  return { kind: "directory", name: entry.name, getEntries: () => getEntries(entry) };
}

async function* getEntries(item: FileSystemDirectoryEntry): AsyncIterable<FileDropItem | DirectoryDropItem> {
  const reader = item.createReader();
  // readEntries may return a limited number of entries at once: call it until empty.
  let entries: FileSystemEntry[];
  do {
    entries = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    for (const entry of entries) {
      if (entry.isFile) yield createFileItem(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
      else if (entry.isDirectory) yield createDirectoryItem(entry as FileSystemDirectoryEntry);
    }
  } while (entries.length > 0);
}

/** Whether a drop item contains text data. */
export function isTextDropItem(dropItem: DropItem): dropItem is TextDropItem {
  return dropItem.kind === "text";
}
/** Whether a drop item is a file. */
export function isFileDropItem(dropItem: DropItem): dropItem is FileDropItem {
  return dropItem.kind === "file";
}
/** Whether a drop item is a directory. */
export function isDirectoryDropItem(dropItem: DropItem): dropItem is DirectoryDropItem {
  return dropItem.kind === "directory";
}

// --- useDrop.ts (native drag events) -----------------------------------------------------------

const DROP_ACTIVATE_TIMEOUT = 800;

interface DropState {
  x: number;
  y: number;
  dragOverElements: Set<Element>;
  dropEffect: DropEffect;
  allowedOperations: number;
  dropActivateTimer: ReturnType<typeof setTimeout> | undefined;
}

const states = new WeakMap<Element, DropState>();
function stateOf(el: Element): DropState {
  let s = states.get(el);
  if (!s) states.set(el, (s = { x: 0, y: 0, dragOverElements: new Set(), dropEffect: "none", allowedOperations: OP.all, dropActivateTimer: undefined }));
  return s;
}

/** The drop target handlers' options: the user's `DropOptions` + the target's state writer (RA `setDropTarget`). */
export interface DropHandlerOptions extends DropOptions {
  setDropTarget: (el: Element, value: boolean) => void;
}

const rectOf = (e: DragEvent) => (e.currentTarget as HTMLElement).getBoundingClientRect();

function fireDropEnter(o: DropHandlerOptions, e: DragEvent): void {
  o.setDropTarget(e.currentTarget as Element, true);
  if (typeof o.onDropEnter === "function") {
    const rect = rectOf(e);
    o.onDropEnter({ type: "dropenter", x: e.clientX - rect.x, y: e.clientY - rect.y });
  }
}

function fireDropExit(o: DropHandlerOptions, e: DragEvent): void {
  o.setDropTarget(e.currentTarget as Element, false);
  if (typeof o.onDropExit === "function") {
    const rect = rectOf(e);
    o.onDropExit({ type: "dropexit", x: e.clientX - rect.x, y: e.clientY - rect.y });
  }
}

/** `dragover`. */
export function dropDragOver(o: DropHandlerOptions, e: DragEvent): void {
  // Rivet: a `dragover` with no recorded `dragenter` = the enter was missed (it loaded the zone's code on a resumed page,
  // or the drag started over the zone): enter now.
  if (stateOf(e.currentTarget as Element).dragOverElements.size === 0) return dropDragEnter(o, e);
  e.preventDefault();
  e.stopPropagation();
  const state = stateOf(e.currentTarget as Element);
  const dataTransfer = e.dataTransfer!;
  const allowedOperations = getAllowedOperations(e);
  if (e.clientX === state.x && e.clientY === state.y && allowedOperations === state.allowedOperations) {
    dataTransfer.dropEffect = state.dropEffect;
    return;
  }
  state.x = e.clientX;
  state.y = e.clientY;
  const prevDropEffect = state.dropEffect;
  // Update the drop effect when the allowed operations changed (e.g. the user pressed a modifier key).
  if (allowedOperations !== state.allowedOperations) {
    const allowedOps = allowedOperationsToArray(allowedOperations);
    let dropOperation = allowedOps[0]!;
    if (typeof o.getDropOperation === "function")
      dropOperation = getDropOperation(allowedOperations, o.getDropOperation(new DragTypes(dataTransfer), allowedOps));
    state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
  }
  if (typeof o.getDropOperationForPoint === "function") {
    const rect = rectOf(e);
    const dropOperation = getDropOperation(
      allowedOperations,
      o.getDropOperationForPoint(new DragTypes(dataTransfer), allowedOperationsToArray(allowedOperations), state.x - rect.x, state.y - rect.y),
    );
    state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
  }
  state.allowedOperations = allowedOperations;
  dataTransfer.dropEffect = state.dropEffect;
  // The drop operation changed: update the state and fire the events.
  if (state.dropEffect === "none" && prevDropEffect !== "none") fireDropExit(o, e);
  else if (state.dropEffect !== "none" && prevDropEffect === "none") fireDropEnter(o, e);
  if (typeof o.onDropMove === "function" && state.dropEffect !== "none") {
    const rect = rectOf(e);
    o.onDropMove({ type: "dropmove", x: state.x - rect.x, y: state.y - rect.y });
  }
  clearTimeout(state.dropActivateTimer);
  if (typeof o.onDropActivate === "function" && state.dropEffect !== "none") {
    const onDropActivate = o.onDropActivate;
    const rect = rectOf(e);
    state.dropActivateTimer = setTimeout(() => onDropActivate({ type: "dropactivate", x: state.x - rect.x, y: state.y - rect.y }), DROP_ACTIVATE_TIMEOUT);
  }
}

/** `dragenter`. */
export function dropDragEnter(o: DropHandlerOptions, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const state = stateOf(e.currentTarget as Element);
  const target = getEventTarget<Element>(e);
  if (target) state.dragOverElements.add(target);
  if (state.dragOverElements.size > 1) return;
  const dataTransfer = e.dataTransfer!;
  const allowedOperationsBits = getAllowedOperations(e);
  const allowedOperations = allowedOperationsToArray(allowedOperationsBits);
  let dropOperation = allowedOperations[0] ?? "cancel";
  if (typeof o.getDropOperation === "function")
    dropOperation = getDropOperation(allowedOperationsBits, o.getDropOperation(new DragTypes(dataTransfer), allowedOperations));
  if (typeof o.getDropOperationForPoint === "function") {
    const rect = rectOf(e);
    dropOperation = getDropOperation(
      allowedOperationsBits,
      o.getDropOperationForPoint(new DragTypes(dataTransfer), allowedOperations, e.clientX - rect.x, e.clientY - rect.y),
    );
  }
  state.x = e.clientX;
  state.y = e.clientY;
  state.allowedOperations = allowedOperationsBits;
  state.dropEffect = DROP_OPERATION_TO_DROP_EFFECT[dropOperation] || "none";
  dataTransfer.dropEffect = state.dropEffect;
  if (dropOperation !== "cancel") fireDropEnter(o, e);
}

/** `dragleave`. */
export function dropDragLeave(o: DropHandlerOptions, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const state = stateOf(e.currentTarget as Element);
  // `relatedTarget` is always null in WebKit (bug 66547): track the dragenter targets, remove them here; an empty set =
  // the drag left the target. Elements no longer in the target never fire dragleave: drop them too.
  const target = getEventTarget<Element>(e);
  if (target) state.dragOverElements.delete(target);
  if (target === e.currentTarget)
    for (const element of state.dragOverElements) if (!nodeContains(e.currentTarget as Node, element)) state.dragOverElements.delete(element);
  if (state.dragOverElements.size > 0) return;
  if (state.dropEffect !== "none") fireDropExit(o, e);
  clearTimeout(state.dropActivateTimer);
}

/** `drop`. */
export function dropDrop(o: DropHandlerOptions, e: DragEvent): void {
  e.preventDefault();
  e.stopPropagation();
  const state = stateOf(e.currentTarget as Element);
  if (typeof o.onDrop === "function") {
    const dropOperation = DROP_EFFECT_TO_DROP_OPERATION[state.dropEffect];
    const items = readFromDataTransfer(e.dataTransfer);
    const rect = rectOf(e);
    o.onDrop({ type: "drop", x: e.clientX - rect.x, y: e.clientY - rect.y, items, dropOperation });
  }
  state.dragOverElements.clear();
  fireDropExit(o, e);
  clearTimeout(state.dropActivateTimer);
}

function getAllowedOperations(e: DragEvent): number {
  const allowedOperations = DROP_OPERATION_ALLOWED[e.dataTransfer!.effectAllowed] ?? OP.all;
  // Chrome and Safari on macOS filter effectAllowed when modifier keys are pressed; Firefox on macOS and all Windows
  // browsers do not: do it ourselves (platform dependent keys). None of these modifiers are set in WebKit (bug 77465),
  // which updates effectAllowed correctly.
  let allowedModifiers: number = OP.none;
  if (isMac()) {
    if (e.altKey) allowedModifiers |= OP.copy;
    // Chrome and Safari use Control for link; iPadOS does not fire drop at all with a link dropEffect.
    if (e.ctrlKey && !isIPad()) allowedModifiers |= OP.link;
    if (e.metaKey) allowedModifiers |= OP.move;
  } else {
    if (e.altKey) allowedModifiers |= OP.link;
    if (e.shiftKey) allowedModifiers |= OP.move;
    if (e.ctrlKey) allowedModifiers |= OP.copy;
  }
  if (allowedModifiers) return allowedOperations & allowedModifiers;
  return allowedOperations;
}

function allowedOperationsToArray(bits: number): DropOperation[] {
  const allowedOperations: DropOperation[] = [];
  if (bits & OP.move) allowedOperations.push("move");
  if (bits & OP.copy) allowedOperations.push("copy");
  if (bits & OP.link) allowedOperations.push("link");
  return allowedOperations;
}

function getDropOperation(allowedOperations: number, operation: DropOperation): DropOperation {
  const op = DROP_OPERATION[operation];
  return allowedOperations & op ? operation : "cancel";
}
