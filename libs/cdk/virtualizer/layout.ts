// Ported from React Spectrum (react-stately/src/virtualizer/Layout.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import type { Node } from "./collection.ts";
import type { LayoutInfo } from "./layout-info.ts";
import type { Rect } from "./rect.ts";
import type { ScrollAnchorInfo } from "./scroll-anchor.ts";
import type { Size } from "./size.ts";
import type { DropTarget, InvalidationContext, ItemDropTarget, LayoutDelegate } from "./types.ts";
import type { Virtualizer } from "./virtualizer-core.ts";

/**
 * Virtualizer supports arbitrary layout objects, which compute what items are visible, and how to position
 * and style them. Layouts produce lightweight LayoutInfo objects; the Virtualizer creates the views.
 * Layouts must implement `getVisibleLayoutInfos`, `getLayoutInfo` and `getContentSize`; the rest is optional.
 */
export abstract class Layout<T extends object = Node<any>, O = any> implements LayoutDelegate {
  /** The Virtualizer the layout is currently attached to. */
  virtualizer: Virtualizer<T, any> | null = null;

  /** Returns an array of `LayoutInfo` objects which are inside the given rectangle. */
  abstract getVisibleLayoutInfos(rect: Rect): LayoutInfo[];

  /** Returns a `LayoutInfo` for the given key. */
  abstract getLayoutInfo(key: Key): LayoutInfo | null;

  /** Returns size of the content. */
  abstract getContentSize(): Size;

  /**
   * Whether the layout should invalidate in response to visible rectangle changes. By default only when the
   * virtualizer's size changes; return true always to invalidate while scrolling (e.g. sticky headers).
   */
  shouldInvalidate(newRect: Rect, oldRect: Rect): boolean {
    return newRect.width !== oldRect.width || newRect.height !== oldRect.height;
  }

  /** Whether the layout should invalidate when the layout options change (default: object identity). */
  shouldInvalidateLayoutOptions(newOptions: O, oldOptions: O): boolean {
    return newOptions !== oldOptions;
  }

  /** Pre-computation before `getVisibleLayoutInfos` / `getLayoutInfo` are called. */
  update(_invalidationContext: InvalidationContext<O>): void {}

  /** Updates the size of the given item. */
  updateItemSize?(key: Key, size: Size): boolean;

  /** Returns a `LayoutInfo` for the given drop target. */
  getDropTargetLayoutInfo?(target: ItemDropTarget): LayoutInfo;

  /** Returns a drop target for a point relative to the visible rect (layouts implementing DropTargetDelegate). */
  getDropTargetFromPoint?(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null;

  /** Edge the viewport stays anchored to across relayouts (e.g. chat lists anchored to the end); unstable. */
  UNSTABLE_getScrollAnchorInfo?(layoutOptions?: O): ScrollAnchorInfo | null;

  /** @private */
  getItemRect(key: Key): Rect | null {
    return this.getLayoutInfo(key)?.rect ?? null;
  }

  /** @private */
  getVisibleRect(): Rect {
    return this.virtualizer!.visibleRect;
  }
}
