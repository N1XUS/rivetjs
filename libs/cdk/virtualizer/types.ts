// Ported from React Spectrum (react-stately/src/virtualizer/types.ts + the virtualizer / drop target types of
// @react-types/shared), Apache-2.0, © Adobe.
// Rivet: drop target types are local (the dnd module may share them later).
import type { Key } from "../collections/index.ts";
import type { Collection } from "./collection.ts";
import type { Layout } from "./layout.ts";
import type { Rect } from "./rect.ts";
import type { Size } from "./size.ts";

export interface InvalidationContext<O = any> {
  contentChanged?: boolean;
  offsetChanged?: boolean;
  sizeChanged?: boolean;
  widthChanged?: boolean;
  heightChanged?: boolean;
  itemSizeChanged?: boolean;
  layoutOptionsChanged?: boolean;
  layoutOptions?: O;
}

export interface VirtualizerDelegate<T extends object, V> {
  setVisibleRect(rect: Rect): void;
  renderView(type: string, content: T | null): V;
  invalidate(ctx: InvalidationContext): void;
}

export interface VirtualizerRenderOptions<T extends object, O = any> {
  layout: Layout<T>;
  collection: Collection<T>;
  persistedKeys?: Set<Key> | null;
  visibleRect: Rect;
  size: Size;
  invalidationContext: InvalidationContext;
  isScrolling: boolean;
  layoutOptions?: O;
}

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };

export type { Direction, Orientation } from "../collections/types.ts";
import type { Direction, Orientation } from "../collections/types.ts";

export type DropPosition = "on" | "before" | "after";
export interface RootDropTarget {
  /** The event type. */
  type: "root";
}
export interface ItemDropTarget {
  /** The drop target type. */
  type: "item";
  /** The item key. */
  key: Key;
  /** The drop position relative to the item. */
  dropPosition: DropPosition;
}
export type DropTarget = RootDropTarget | ItemDropTarget;

export interface DropTargetDelegate {
  /** Returns a drop target within a collection for the given x and y coordinates (relative to the visible rect). */
  getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null;
}

/** A LayoutDelegate provides layout information for collection items. */
export interface LayoutDelegate {
  /** Returns a rectangle for the item with the given key. */
  getItemRect(key: Key): Rect | null;
  /** Returns the visible rectangle of the collection. */
  getVisibleRect(): Rect;
  /** Returns the size of the scrollable content in the collection. */
  getContentSize(): Size;
  /** Returns a list of keys between `from` and `to`. */
  getKeyRange?(from: Key, to: Key): Key[];
}
