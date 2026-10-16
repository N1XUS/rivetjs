// Ported from React Spectrum (react-stately/src/layout/GridLayout.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import type { Node } from "./collection.ts";
import { Layout } from "./layout.ts";
import { LayoutInfo } from "./layout-info.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { Direction, DropTarget, DropTargetDelegate, InvalidationContext, ItemDropTarget } from "./types.ts";

export interface GridLayoutOptions {
  /** The minimum item size. Default 200 x 200. */
  minItemSize?: Size;
  /** The maximum item size. Default Infinity. */
  maxItemSize?: Size;
  /** Preserve the aspect ratio of `minItemSize` (all rows equal height). Default false (variable rows). */
  preserveAspectRatio?: boolean;
  /** The minimum space required between items. Default 18 x 18. */
  minSpace?: Size;
  /** The maximum allowed horizontal space between items. Default Infinity. */
  maxHorizontalSpace?: number;
  /** The maximum number of columns. Default Infinity. */
  maxColumns?: number;
  /** The thickness of the drop indicator. Default 2. */
  dropIndicatorThickness?: number;
  /** The fixed height of a "load more" loader element in px. Default 48. */
  loaderHeight?: number;
  /** Layout direction: `rtl` flips drop target `before` / `after` in multi-column grids. Default `ltr`. */
  direction?: Direction;
}

const DEFAULT_OPTIONS = {
  minItemSize: new Size(200, 200),
  maxItemSize: new Size(Infinity, Infinity),
  preserveAspectRatio: false,
  minSpace: new Size(18, 18),
  maxSpace: Infinity,
  maxColumns: Infinity,
  dropIndicatorThickness: 2,
  loaderHeight: 48,
};

/** Arranges items in a grid; items are sized between a minimum and maximum size depending on the container width. */
export class GridLayout<T, O extends GridLayoutOptions = GridLayoutOptions> extends Layout<Node<T>, O> implements DropTargetDelegate {
  protected gap: Size = DEFAULT_OPTIONS.minSpace;
  protected dropIndicatorThickness = 2;
  protected numColumns: number = 0;
  protected direction: Direction = "ltr";
  private contentSize: Size = new Size();
  private layoutInfos: Map<Key, LayoutInfo> = new Map();
  private margin: number = 0;

  override shouldInvalidateLayoutOptions(newOptions: O, oldOptions: O): boolean {
    return (
      newOptions.maxColumns !== oldOptions.maxColumns ||
      newOptions.dropIndicatorThickness !== oldOptions.dropIndicatorThickness ||
      newOptions.preserveAspectRatio !== oldOptions.preserveAspectRatio ||
      !sizeOf(newOptions.minItemSize, DEFAULT_OPTIONS.minItemSize).equals(sizeOf(oldOptions.minItemSize, DEFAULT_OPTIONS.minItemSize)) ||
      !sizeOf(newOptions.maxItemSize, DEFAULT_OPTIONS.maxItemSize).equals(sizeOf(oldOptions.maxItemSize, DEFAULT_OPTIONS.maxItemSize)) ||
      !sizeOf(newOptions.minSpace, DEFAULT_OPTIONS.minSpace).equals(sizeOf(oldOptions.minSpace, DEFAULT_OPTIONS.minSpace)) ||
      newOptions.maxHorizontalSpace !== oldOptions.maxHorizontalSpace ||
      newOptions.loaderHeight !== oldOptions.loaderHeight ||
      newOptions.direction !== oldOptions.direction
    );
  }

  override update(invalidationContext: InvalidationContext<O>): void {
    const options = (invalidationContext.layoutOptions || {}) as GridLayoutOptions;
    const minItemSize = sizeOf(options.minItemSize, DEFAULT_OPTIONS.minItemSize);
    const maxItemSize = sizeOf(options.maxItemSize, DEFAULT_OPTIONS.maxItemSize);
    const minSpace = sizeOf(options.minSpace, DEFAULT_OPTIONS.minSpace);
    const {
      preserveAspectRatio = DEFAULT_OPTIONS.preserveAspectRatio,
      maxHorizontalSpace = DEFAULT_OPTIONS.maxSpace,
      maxColumns = DEFAULT_OPTIONS.maxColumns,
    } = options;
    const { dropIndicatorThickness = DEFAULT_OPTIONS.dropIndicatorThickness, direction = "ltr" } = options;
    let loaderHeight = options.loaderHeight ?? DEFAULT_OPTIONS.loaderHeight;
    this.dropIndicatorThickness = dropIndicatorThickness;
    this.direction = direction;

    const virtualizerWidth = this.virtualizer!.size.width;

    // The max item width is always the entire viewport; an infinite max height scales with the max width.
    const maxItemWidth = Math.min(maxItemSize.width, virtualizerWidth);
    const maxItemHeight = Number.isFinite(maxItemSize.height) ? maxItemSize.height : Math.floor((minItemSize.height / minItemSize.width) * maxItemWidth);

    // Compute the number of rows and columns needed to display the content.
    const columns = Math.floor(virtualizerWidth / (minItemSize.width + minSpace.width));
    const numColumns = Math.max(1, Math.min(maxColumns, columns));
    this.numColumns = numColumns;

    // Compute the available width (minus the space between items).
    const width = virtualizerWidth - minSpace.width * Math.max(0, numColumns);

    // Compute the item width based on the space available.
    let itemWidth = Math.floor(width / numColumns);
    itemWidth = Math.max(minItemSize.width, Math.min(maxItemWidth, itemWidth));

    // Compute the item height, which is proportional to the item width.
    const t = (itemWidth - minItemSize.width) / Math.max(1, maxItemWidth - minItemSize.width);
    let itemHeight = minItemSize.height + Math.floor((maxItemHeight - minItemSize.height) * t);
    itemHeight = Math.max(minItemSize.height, Math.min(maxItemHeight, itemHeight));

    // Compute the horizontal spacing, content height and horizontal margin.
    const horizontalSpacing = Math.min(
      Math.max(maxHorizontalSpace, minSpace.width),
      Math.floor((virtualizerWidth - numColumns * itemWidth) / (numColumns + 1)),
    );
    this.gap = new Size(horizontalSpacing, minSpace.height);
    this.margin = Math.floor((virtualizerWidth - numColumns * itemWidth - horizontalSpacing * (numColumns + 1)) / 2);

    // A skeleton loader within the last 2 items adds a row for the skeletons.
    const collection = this.virtualizer!.collection;
    let collectionSize = collection.size;
    let lastKey = collection.getLastKey();
    for (let i = 0; i < 2 && lastKey != null; i++) {
      const item = collection.getItem(lastKey);
      if (item?.type === "skeleton") {
        collectionSize++;
        break;
      }
      lastKey = collection.getKeyBefore(lastKey);
    }

    let rows = Math.ceil(collectionSize / numColumns);
    const iterator = collection[Symbol.iterator]();
    let y = rows > 0 ? minSpace.height : 0;
    const newLayoutInfos = new Map<Key, LayoutInfo>();
    let skeleton: Node<T> | null = null;
    let skeletonCount = 0;
    for (let row = 0; row < rows; row++) {
      let maxHeight = 0;
      const rowLayoutInfos: LayoutInfo[] = [];
      for (let col = 0; col < numColumns; col++) {
        // Repeat skeleton until the end of the current row.
        const node: Node<T> | undefined = skeleton || iterator.next().value;
        if (!node) break;
        // The loader is added after the skeletons.
        if (node.type === "loader") continue;
        if (node.type === "skeleton") skeleton = node;

        const key = skeleton ? `${skeleton.key}-${skeletonCount++}` : node.key;
        const oldLayoutInfo = this.layoutInfos.get(key);
        let content: any = node;
        if (skeleton) content = oldLayoutInfo && oldLayoutInfo.content.key === key ? oldLayoutInfo.content : { ...skeleton, key };
        const x = horizontalSpacing + col * (itemWidth + horizontalSpacing) + this.margin;
        let height = itemHeight;
        let estimatedSize = !preserveAspectRatio;
        if (oldLayoutInfo && estimatedSize) {
          height = oldLayoutInfo.rect.height;
          estimatedSize =
            !!invalidationContext.layoutOptionsChanged || !!invalidationContext.sizeChanged || oldLayoutInfo.estimatedSize || oldLayoutInfo.content !== content;
        }

        const layoutInfo = new LayoutInfo(node.type, key, new Rect(x, y, itemWidth, height));
        layoutInfo.estimatedSize = estimatedSize;
        layoutInfo.allowOverflow = true;
        layoutInfo.content = content;
        newLayoutInfos.set(key, layoutInfo);
        rowLayoutInfos.push(layoutInfo);
        maxHeight = Math.max(maxHeight, layoutInfo.rect.height);
      }

      for (const layoutInfo of rowLayoutInfos) layoutInfo.rect.height = maxHeight;
      y += maxHeight + minSpace.height;

      // Keep adding skeleton rows until we fill the viewport.
      if (skeleton && row === rows - 1 && y < this.virtualizer!.size.height) rows++;
    }

    // Always add the loader sentinel if present, so it is never virtualized out.
    const lastNode = collection.getItem(collection.getLastKey()!);
    if (lastNode?.type === "loader") {
      if (skeletonCount > 0 || !lastNode.props.isLoading) loaderHeight = 0;
      const loaderWidth = virtualizerWidth - horizontalSpacing * 2;
      // An `isLoading` sentinel reserves room for the loader (also alongside an empty state).
      const layoutInfo = new LayoutInfo("loader", lastNode.key, new Rect(horizontalSpacing, y, loaderWidth, loaderHeight));
      newLayoutInfos.set(lastNode.key, layoutInfo);
      y = layoutInfo.rect.maxY;
    }

    this.layoutInfos = newLayoutInfos;
    this.contentSize = new Size(this.virtualizer!.size.width, y);
  }

  getLayoutInfo(key: Key): LayoutInfo | null {
    return this.layoutInfos.get(key) || null;
  }

  getContentSize(): Size {
    return this.contentSize;
  }

  getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    const layoutInfos: LayoutInfo[] = [];
    for (const layoutInfo of this.layoutInfos.values()) {
      if (layoutInfo.rect.intersects(rect) || this.virtualizer!.isPersistedKey(layoutInfo.key) || layoutInfo.type === "loader") {
        layoutInfos.push(layoutInfo);
      }
    }
    return layoutInfos;
  }

  override updateItemSize(key: Key, size: Size): boolean {
    const layoutInfo = this.layoutInfos.get(key);
    if (!size || !layoutInfo) return false;
    if (size.height !== layoutInfo.rect.height) {
      const newLayoutInfo = layoutInfo.copy();
      newLayoutInfo.rect.height = size.height;
      newLayoutInfo.estimatedSize = false;
      this.layoutInfos.set(key, newLayoutInfo);
      return true;
    }
    return false;
  }

  override getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget {
    if (this.layoutInfos.size === 0) return { type: "root" };

    x += this.virtualizer!.visibleRect.x;
    y += this.virtualizer!.visibleRect.y;

    // RTL: items are positioned with `right` = rect.x, pointer coordinates are left-origin; flip x.
    if (this.direction === "rtl" && this.numColumns > 1) x = this.contentSize.width - x;

    // Find the closest item within on either side of the point using the gap width.
    let key: Key | null = null;
    if (this.numColumns === 1) {
      const searchRect = new Rect(x, Math.max(0, y - this.gap.height), 1, Math.max(1, this.gap.height * 2));
      let minDistance = Infinity;
      for (const candidate of this.getVisibleLayoutInfos(searchRect)) {
        // Ignore items outside the search rect, e.g. persisted keys.
        if (!candidate.rect.intersects(searchRect)) continue;
        const dist = Math.min(Math.abs(candidate.rect.y - y), Math.abs(candidate.rect.maxY - y));
        if (dist < minDistance) {
          minDistance = dist;
          key = candidate.key;
        }
      }
    } else {
      const searchRect = new Rect(Math.max(0, x - this.gap.width), y, this.gap.width * 2, 1);
      let minDistance = Infinity;
      for (const candidate of this.getVisibleLayoutInfos(searchRect)) {
        if (!candidate.rect.intersects(searchRect)) continue;
        const dist = Math.min(Math.abs(candidate.rect.x - x), Math.abs(candidate.rect.maxX - x));
        if (dist < minDistance) {
          minDistance = dist;
          key = candidate.key;
        }
      }
    }

    const layoutInfo = key != null ? this.getLayoutInfo(key) : null;
    if (!layoutInfo) return { type: "root" };

    const target: DropTarget = { type: "item", key: layoutInfo.key, dropPosition: "on" };
    const pos = this.numColumns === 1 ? y : x;
    const layoutInfoPos = this.numColumns === 1 ? layoutInfo.rect.y : layoutInfo.rect.x;
    const size = this.numColumns === 1 ? layoutInfo.rect.height : layoutInfo.rect.width;
    if (isValidDropTarget(target)) {
      // Accepted: still before / after within 5px of the start or end of the item.
      if (pos < layoutInfoPos + 5) target.dropPosition = "before";
      else if (pos > layoutInfoPos + size - 5) target.dropPosition = "after";
    } else {
      // Not accepted: before / after depending on the position.
      const mid = layoutInfoPos + size / 2;
      if (pos <= mid && isValidDropTarget({ ...target, dropPosition: "before" })) target.dropPosition = "before";
      else if (pos >= mid && isValidDropTarget({ ...target, dropPosition: "after" })) target.dropPosition = "after";
    }
    return target;
  }

  override getDropTargetLayoutInfo(target: ItemDropTarget): LayoutInfo {
    const layoutInfo = this.getLayoutInfo(target.key)!;
    const t = this.dropIndicatorThickness;
    let rect: Rect;
    if (this.numColumns === 1) {
      // Flip from vertical to horizontal if only one column is visible.
      rect = new Rect(
        layoutInfo.rect.x,
        target.dropPosition === "before" ? layoutInfo.rect.y - this.gap.height / 2 - t / 2 : layoutInfo.rect.maxY + this.gap.height / 2 - t / 2,
        layoutInfo.rect.width,
        t,
      );
    } else {
      rect = new Rect(
        target.dropPosition === "before" ? layoutInfo.rect.x - this.gap.width / 2 - t / 2 : layoutInfo.rect.maxX + this.gap.width / 2 - t / 2,
        layoutInfo.rect.y,
        t,
        layoutInfo.rect.height,
      );
    }
    return new LayoutInfo("dropIndicator", target.key + ":" + target.dropPosition, rect);
  }
}

/** Layout options may arrive as plain `{ width, height }` objects (serialized props): normalize to `Size`. */
export function sizeOf(value: { width: number; height: number } | null | undefined, fallback: Size): Size {
  if (!value) return fallback;
  return value instanceof Size ? value : new Size(value.width, value.height);
}
