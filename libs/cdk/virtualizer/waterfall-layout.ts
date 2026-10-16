// Ported from React Spectrum (react-stately/src/layout/WaterfallLayout.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import type { Node } from "./collection.ts";
import { sizeOf } from "./grid-layout.ts";
import { Layout } from "./layout.ts";
import { LayoutInfo } from "./layout-info.ts";
import { Point } from "./point.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { DropTarget, DropTargetDelegate, InvalidationContext, LayoutDelegate } from "./types.ts";

export interface WaterfallLayoutOptions {
  /** The minimum item size. Default 200 x 200. */
  minItemSize?: Size;
  /** The maximum item size. Default Infinity. */
  maxItemSize?: Size;
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
}

class WaterfallLayoutInfo extends LayoutInfo {
  column = 0;
  index = 0;

  override copy(): WaterfallLayoutInfo {
    const res = super.copy() as WaterfallLayoutInfo;
    res.column = this.column;
    res.index = this.index;
    return res;
  }
}

const DEFAULT_OPTIONS = {
  minItemSize: new Size(200, 200),
  maxItemSize: new Size(Infinity, Infinity),
  minSpace: new Size(18, 18),
  maxSpace: Infinity,
  maxColumns: Infinity,
  dropIndicatorThickness: 2,
  loaderHeight: 48,
};

/** Masonry: items of a column stack with their measured heights; each item goes to the shortest column. */
export class WaterfallLayout<T extends object, O extends WaterfallLayoutOptions = WaterfallLayoutOptions>
  extends Layout<Node<T>, O>
  implements LayoutDelegate, DropTargetDelegate
{
  private contentSize: Size = new Size();
  private layoutInfos: Map<Key, WaterfallLayoutInfo> = new Map();
  protected numColumns = 0;
  protected dropIndicatorThickness = 2;
  private margin: number = 0;

  override shouldInvalidateLayoutOptions(newOptions: O, oldOptions: O): boolean {
    return (
      newOptions.maxColumns !== oldOptions.maxColumns ||
      newOptions.dropIndicatorThickness !== oldOptions.dropIndicatorThickness ||
      !sizeOf(newOptions.minItemSize, DEFAULT_OPTIONS.minItemSize).equals(sizeOf(oldOptions.minItemSize, DEFAULT_OPTIONS.minItemSize)) ||
      !sizeOf(newOptions.maxItemSize, DEFAULT_OPTIONS.maxItemSize).equals(sizeOf(oldOptions.maxItemSize, DEFAULT_OPTIONS.maxItemSize)) ||
      !sizeOf(newOptions.minSpace, DEFAULT_OPTIONS.minSpace).equals(sizeOf(oldOptions.minSpace, DEFAULT_OPTIONS.minSpace)) ||
      newOptions.maxHorizontalSpace !== oldOptions.maxHorizontalSpace ||
      newOptions.loaderHeight !== oldOptions.loaderHeight
    );
  }

  override update(invalidationContext: InvalidationContext<O>): void {
    const options = (invalidationContext.layoutOptions || {}) as WaterfallLayoutOptions;
    const minItemSize = sizeOf(options.minItemSize, DEFAULT_OPTIONS.minItemSize);
    const maxItemSize = sizeOf(options.maxItemSize, DEFAULT_OPTIONS.maxItemSize);
    const minSpace = sizeOf(options.minSpace, DEFAULT_OPTIONS.minSpace);
    const {
      maxHorizontalSpace = DEFAULT_OPTIONS.maxSpace,
      maxColumns = DEFAULT_OPTIONS.maxColumns,
      dropIndicatorThickness = DEFAULT_OPTIONS.dropIndicatorThickness,
    } = options;
    let loaderHeight = options.loaderHeight ?? DEFAULT_OPTIONS.loaderHeight;
    this.dropIndicatorThickness = dropIndicatorThickness;
    const virtualizerWidth = this.virtualizer!.size.width;

    // The max item width is always the entire viewport; an infinite max height scales with the max width.
    const maxItemWidth = Math.min(maxItemSize.width, virtualizerWidth);
    const maxItemHeight = Number.isFinite(maxItemSize.height) ? maxItemSize.height : Math.floor((minItemSize.height / minItemSize.width) * maxItemWidth);

    // Compute the number of rows and columns needed to display the content.
    const columns = Math.floor(virtualizerWidth / (minItemSize.width + minSpace.width));
    const numColumns = Math.max(1, Math.min(maxColumns, columns));

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
    this.margin = Math.floor((virtualizerWidth - numColumns * itemWidth - horizontalSpacing * (numColumns + 1)) / 2);

    // Setup an array of column heights.
    const columnHeights: number[] = Array(numColumns).fill(minSpace.height);
    const newLayoutInfos = new Map<Key, WaterfallLayoutInfo>();
    let index = 0;
    const addNode = (key: Key, node: Node<T>) => {
      const oldLayoutInfo = this.layoutInfos.get(key);
      let height = itemHeight;
      let estimatedSize = true;
      if (oldLayoutInfo) {
        height = (oldLayoutInfo.rect.height / oldLayoutInfo.rect.width) * itemWidth;
        estimatedSize = !!invalidationContext.sizeChanged || oldLayoutInfo.estimatedSize || oldLayoutInfo.content !== node;
      }

      // Keep the previous column so items don't jump around while resizing, unless the column count changed.
      const prevColumn =
        numColumns === this.numColumns && oldLayoutInfo && oldLayoutInfo.index === index && oldLayoutInfo.rect.y < this.virtualizer!.visibleRect.maxY
          ? oldLayoutInfo.column
          : undefined;
      const column = prevColumn ?? columnHeights.reduce((minIndex, h, i) => (h < columnHeights[minIndex]! ? i : minIndex), 0);
      const x = horizontalSpacing + column * (itemWidth + horizontalSpacing) + this.margin;
      const y = columnHeights[column]!;

      const layoutInfo = new WaterfallLayoutInfo(node.type, key, new Rect(x, y, itemWidth, height));
      layoutInfo.estimatedSize = estimatedSize;
      layoutInfo.allowOverflow = true;
      layoutInfo.content = node;
      layoutInfo.column = column;
      layoutInfo.index = index++;
      newLayoutInfos.set(key, layoutInfo);
      columnHeights[column]! += layoutInfo.rect.height + minSpace.height;
    };

    const collection = this.virtualizer!.collection;
    let skeletonCount = 0;
    for (const node of collection) {
      if (node.type === "skeleton") {
        // Add skeleton cards until every column has at least one, and we fill the viewport.
        const startingHeights = [...columnHeights];
        while (!columnHeights.every((h, i) => h !== startingHeights[i]) || Math.min(...columnHeights) < this.virtualizer!.size.height) {
          const key = `${node.key}-${skeletonCount++}`;
          const content = this.layoutInfos.get(key)?.content || { ...node };
          addNode(key, content);
        }
        break;
      } else if (node.type !== "loader") {
        addNode(node.key, node);
      }
    }

    // Empty / loading (no skeleton): height 0 so the virtualizer renders no body.
    const isEmptyOrLoading = collection?.size === 0 && collection.getItem(collection.getFirstKey()!)?.type !== "skeleton";
    let maxHeight = isEmptyOrLoading ? 0 : Math.max(...columnHeights);

    // Always add the loader sentinel if present (under the first column), so it is never virtualized out.
    const lastNode = collection.getItem(collection.getLastKey()!);
    if (lastNode?.type === "loader") {
      if (skeletonCount > 0 || !lastNode.props.isLoading) loaderHeight = 0;
      const loaderWidth = virtualizerWidth - horizontalSpacing * 2;
      const layoutInfo = new LayoutInfo("loader", lastNode.key, new Rect(horizontalSpacing, maxHeight, loaderWidth, loaderHeight));
      newLayoutInfos.set(lastNode.key, layoutInfo as WaterfallLayoutInfo);
      maxHeight = layoutInfo.rect.maxY;
    }

    this.contentSize = new Size(this.virtualizer!.size.width, maxHeight);
    this.layoutInfos = newLayoutInfos;
    this.numColumns = numColumns;
  }

  getLayoutInfo(key: Key): LayoutInfo {
    return this.layoutInfos.get(key)!;
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

  // Keyboard navigation works spatially.
  getKeyRightOf(key: Key): Key | null {
    const layoutInfo = this.getLayoutInfo(key);
    if (!layoutInfo) return null;
    const rect = new Rect(layoutInfo.rect.maxX, layoutInfo.rect.y, this.virtualizer!.visibleRect.maxX - layoutInfo.rect.maxX, layoutInfo.rect.height);
    let bestKey: Key | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.getVisibleLayoutInfos(rect)) {
      if (candidate.key === key) continue;
      // Closest item in the x direction with the most overlap in the y direction.
      const deltaX = candidate.rect.x - rect.x;
      const overlapY = Math.min(candidate.rect.maxY, rect.maxY) - Math.max(candidate.rect.y, rect.y);
      const distance = deltaX - overlapY;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = candidate.key;
      }
    }
    return bestKey;
  }

  getKeyLeftOf(key: Key): Key | null {
    const layoutInfo = this.getLayoutInfo(key);
    if (!layoutInfo) return null;
    const rect = new Rect(0, layoutInfo.rect.y, layoutInfo.rect.x, layoutInfo.rect.height);
    let bestKey: Key | null = null;
    let bestDistance = Infinity;
    for (const candidate of this.getVisibleLayoutInfos(rect)) {
      if (candidate.key === key) continue;
      const deltaX = rect.maxX - candidate.rect.maxX;
      const overlapY = Math.min(candidate.rect.maxY, rect.maxY) - Math.max(candidate.rect.y, rect.y);
      const distance = deltaX - overlapY;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestKey = candidate.key;
      }
    }
    return bestKey;
  }

  // Shift selection works spatially rather than in (unpredictable) collection order.
  getKeyRange(from: Key, to: Key): Key[] {
    const fromLayoutInfo = this.getLayoutInfo(from);
    const toLayoutInfo = this.getLayoutInfo(to);
    if (!fromLayoutInfo || !toLayoutInfo) return [];
    // Items where half of the area intersects the rectangle from the first to the last item.
    const rect = fromLayoutInfo.rect.union(toLayoutInfo.rect);
    const keys: Key[] = [];
    for (const layoutInfo of this.layoutInfos.values()) {
      if (rect.intersection(layoutInfo.rect).area > layoutInfo.rect.area / 2) keys.push(layoutInfo.key);
    }
    return keys;
  }

  override getDropTargetFromPoint(x: number, y: number): DropTarget {
    if (this.layoutInfos.size === 0) return { type: "root" };
    x += this.virtualizer!.visibleRect.x;
    y += this.virtualizer!.visibleRect.y;
    const key = this.virtualizer!.keyAtPoint(new Point(x, y));
    if (key == null) return { type: "root" };
    // Only "on": reordering doesn't make sense, items have no deterministic order.
    return { type: "item", key, dropPosition: "on" };
  }
}
