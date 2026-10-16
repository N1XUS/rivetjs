// Ported from React Spectrum (react-stately/src/layout/ListLayout.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import { type Collection, getChildNodes, type Node } from "./collection.ts";
import { Layout } from "./layout.ts";
import { LayoutInfo } from "./layout-info.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { DropTarget, DropTargetDelegate, InvalidationContext, ItemDropTarget, Orientation } from "./types.ts";

export interface ListLayoutOptions {
  /** The primary orientation of the items (usually the scroll direction). Default `vertical`. */
  orientation?: Orientation;
  /** The fixed size of a row in px with respect to the applied orientation. Default 48. */
  rowSize?: number;
  /** The estimated size of a row in px with respect to the applied orientation, when row sizes are variable. */
  estimatedRowSize?: number;
  /** The fixed size of a section header in px with respect to the applied orientation. Default 48. */
  headingSize?: number;
  /** The estimated size of a section header in px, when heading sizes are variable. */
  estimatedHeadingSize?: number;
  /** The fixed size of a "load more" loader element in px with respect to the applied orientation. Default 48. */
  loaderSize?: number;
  /** The thickness of the drop indicator. Default 2. */
  dropIndicatorThickness?: number;
  /** The gap between items. Default 0. */
  gap?: number;
  /** The padding around the list. Default 0. */
  padding?: number;
  /** @deprecated Use `rowSize`. */
  rowHeight?: number;
  /** @deprecated Use `estimatedRowSize`. */
  estimatedRowHeight?: number;
  /** @deprecated Use `headingSize`. */
  headingHeight?: number;
  /** @deprecated Use `estimatedHeadingSize`. */
  estimatedHeadingHeight?: number;
  /** @deprecated Use `loaderSize`. */
  loaderHeight?: number;
}

/** A wrapper around LayoutInfo that supports hierarchy. */
export interface LayoutNode {
  node?: Node<unknown>;
  layoutInfo: LayoutInfo;
  children?: LayoutNode[];
  validRect: Rect;
  index?: number;
}

const DEFAULT_HEIGHT = 48;

/** Arranges items in a stack along its orientation; fixed and variable size items. */
export class ListLayout<T, O extends ListLayoutOptions = ListLayoutOptions> extends Layout<Node<T>, O> implements DropTargetDelegate {
  protected rowSize: number | null;
  protected orientation: Orientation;
  protected estimatedRowSize: number | null;
  protected headingSize: number | null;
  protected estimatedHeadingSize: number | null;
  protected loaderSize: number | null;
  protected dropIndicatorThickness: number;
  protected gap: number;
  protected padding: number;
  protected layoutNodes: Map<Key, LayoutNode>;
  protected contentSize: Size;
  protected lastCollection: Collection<Node<T>> | null;
  protected rootNodes: LayoutNode[];
  private invalidateEverything: boolean;
  /** The rectangle containing currently valid layout infos. */
  protected validRect: Rect;
  /** The rectangle of requested layout infos so far. */
  protected requestedRect: Rect;

  constructor(options: ListLayoutOptions = {}) {
    super();
    this.rowSize = options?.rowSize ?? options?.rowHeight ?? null;
    this.orientation = options.orientation ?? "vertical";
    this.estimatedRowSize = options?.estimatedRowSize ?? options?.estimatedRowHeight ?? null;
    this.headingSize = options?.headingSize ?? options?.headingHeight ?? null;
    this.estimatedHeadingSize = options?.estimatedHeadingSize ?? options?.estimatedHeadingHeight ?? null;
    this.loaderSize = options?.loaderSize ?? options?.loaderHeight ?? null;
    this.dropIndicatorThickness = options.dropIndicatorThickness || 2;
    this.gap = options.gap || 0;
    this.padding = options.padding || 0;
    this.layoutNodes = new Map();
    this.rootNodes = [];
    this.lastCollection = null;
    this.invalidateEverything = false;
    this.validRect = new Rect();
    this.requestedRect = new Rect();
    this.contentSize = new Size();
  }

  // Backward compatibility for subclassing.
  protected get collection(): Collection<Node<T>> {
    return this.virtualizer!.collection;
  }

  /** @deprecated Use `rowSize` instead. */
  protected get rowHeight(): number | null {
    return this.rowSize;
  }

  /** @deprecated Use `estimatedRowSize` instead. */
  protected get estimatedRowHeight(): number | null {
    return this.estimatedRowSize;
  }

  /** @deprecated Use `headingSize` instead. */
  protected get headingHeight(): number | null {
    return this.headingSize;
  }

  /** @deprecated Use `estimatedHeadingSize` instead. */
  protected get estimatedHeadingHeight(): number | null {
    return this.estimatedHeadingSize;
  }

  /** @deprecated Use `loaderSize` instead. */
  protected get loaderHeight(): number | null {
    return this.loaderSize;
  }

  protected get offsetProperty(): "x" | "y" {
    return this.orientation === "horizontal" ? "x" : "y";
  }

  protected get maxOffsetProperty(): "maxX" | "maxY" {
    return this.orientation === "horizontal" ? "maxX" : "maxY";
  }

  protected get sizeProperty(): "width" | "height" {
    return this.orientation === "horizontal" ? "width" : "height";
  }

  protected get crossSizeProperty(): "width" | "height" {
    return this.orientation === "horizontal" ? "height" : "width";
  }

  getLayoutInfo(key: Key): LayoutInfo | null {
    this.ensureLayoutInfo(key);
    return this.layoutNodes.get(key)?.layoutInfo || null;
  }

  getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    const offsetProperty = this.offsetProperty;
    const heightProperty = this.sizeProperty;

    // Adjust rect to keep number of visible rows consistent (only if > 1 px, for getDropTargetFromPoint).
    if (rect[heightProperty] > 1) {
      const rowHeight = (this.rowSize ?? this.estimatedRowSize ?? DEFAULT_HEIGHT) + this.gap;
      rect = rect.copy();
      const offset = Math.floor(rect[offsetProperty] / rowHeight) * rowHeight;
      const height = rect[heightProperty] + rect[offsetProperty] - offset;
      rect[offsetProperty] = offset;
      rect[heightProperty] = Math.ceil(height / rowHeight) * rowHeight;
    }

    // If layout hasn't yet been done for the requested rect, union it with the valid rect, and recompute.
    this.layoutIfNeeded(rect);

    const res: LayoutInfo[] = [];
    const addNodes = (nodes: LayoutNode[]) => {
      for (const node of nodes) {
        if (this.isVisible(node, rect)) {
          res.push(node.layoutInfo);
          if (node.children) addNodes(node.children);
        }
      }
    };
    addNodes(this.rootNodes);
    return res;
  }

  protected layoutIfNeeded(rect: Rect): void {
    if (!this.lastCollection) return;
    if (!this.requestedRect.containsRect(rect)) {
      this.requestedRect = this.requestedRect.union(rect);
      this.rootNodes = this.buildCollection();
    }
    // Ensure all of the persisted keys are available.
    for (const key of this.virtualizer!.persistedKeys) if (this.ensureLayoutInfo(key)) return;
  }

  private ensureLayoutInfo(key: Key): boolean {
    // Not found: it may be outside the area laid out so far (random access, e.g. Home/End). Lay out fully.
    if (!this.layoutNodes.has(key) && this.requestedRect.area < this.contentSize.area && this.lastCollection) {
      this.requestedRect = new Rect(0, 0, Infinity, Infinity);
      this.rootNodes = this.buildCollection();
      this.requestedRect = new Rect(0, 0, this.contentSize.width, this.contentSize.height);
      return true;
    }
    return false;
  }

  protected isVisible(node: LayoutNode, rect: Rect): boolean {
    return (
      node.layoutInfo.rect.intersects(rect) ||
      node.layoutInfo.isSticky ||
      node.layoutInfo.type === "header" ||
      node.layoutInfo.type === "loader" ||
      this.virtualizer!.isPersistedKey(node.layoutInfo.key)
    );
  }

  protected shouldInvalidateEverything(invalidationContext: InvalidationContext<O>): boolean {
    const options = invalidationContext.layoutOptions;
    return (
      !!invalidationContext.sizeChanged ||
      this.rowSize !== (options?.rowSize ?? options?.rowHeight ?? this.rowSize) ||
      this.orientation !== (options?.orientation ?? this.orientation) ||
      this.headingSize !== (options?.headingSize ?? options?.headingHeight ?? this.headingSize) ||
      this.loaderSize !== (options?.loaderSize ?? options?.loaderHeight ?? this.loaderSize) ||
      this.gap !== (options?.gap ?? this.gap) ||
      this.padding !== (options?.padding ?? this.padding)
    );
  }

  override shouldInvalidateLayoutOptions(newOptions: O, oldOptions: O): boolean {
    return (
      (newOptions?.rowSize ?? newOptions?.rowHeight) !== (oldOptions?.rowSize ?? oldOptions?.rowHeight) ||
      newOptions.orientation !== oldOptions.orientation ||
      (newOptions?.estimatedRowSize ?? newOptions?.estimatedRowHeight) !== (oldOptions?.estimatedRowSize ?? oldOptions?.estimatedRowHeight) ||
      (newOptions?.headingSize ?? newOptions?.headingHeight) !== (oldOptions?.headingSize ?? oldOptions?.headingHeight) ||
      (newOptions?.estimatedHeadingSize ?? newOptions?.estimatedHeadingHeight) !== (oldOptions?.estimatedHeadingSize ?? oldOptions?.estimatedHeadingHeight) ||
      (newOptions?.loaderSize ?? newOptions?.loaderHeight) !== (oldOptions?.loaderSize ?? oldOptions?.loaderHeight) ||
      newOptions.dropIndicatorThickness !== oldOptions.dropIndicatorThickness ||
      newOptions.gap !== oldOptions.gap ||
      newOptions.padding !== oldOptions.padding
    );
  }

  override update(invalidationContext: InvalidationContext<O>): void {
    const collection = this.virtualizer!.collection;

    // Reset the valid rect if everything is invalidated; else cached layout infos outside the visible rect stay.
    this.invalidateEverything = this.shouldInvalidateEverything(invalidationContext);
    if (this.invalidateEverything) {
      this.requestedRect = this.virtualizer!.visibleRect.copy();
      this.layoutNodes.clear();
    }

    const options = invalidationContext.layoutOptions;
    this.rowSize = options?.rowSize ?? options?.rowHeight ?? this.rowSize;
    this.orientation = options?.orientation ?? this.orientation;
    this.estimatedRowSize = options?.estimatedRowSize ?? options?.estimatedRowHeight ?? this.estimatedRowSize;
    this.headingSize = options?.headingSize ?? options?.headingHeight ?? this.headingSize;
    this.estimatedHeadingSize = options?.estimatedHeadingSize ?? options?.estimatedHeadingHeight ?? this.estimatedHeadingSize;
    this.loaderSize = options?.loaderSize ?? options?.loaderHeight ?? this.loaderSize;
    this.dropIndicatorThickness = options?.dropIndicatorThickness ?? this.dropIndicatorThickness;
    this.gap = options?.gap ?? this.gap;
    this.padding = options?.padding ?? this.padding;

    this.rootNodes = this.buildCollection();

    // Remove deleted layout nodes.
    if (this.lastCollection && collection !== this.lastCollection) {
      for (const key of this.lastCollection.getKeys()) if (!collection.getItem(key)) this.layoutNodes.delete(key);
    }

    this.lastCollection = collection;
    this.invalidateEverything = false;
    this.validRect = this.requestedRect.copy();
  }

  protected buildCollection(offset: number = this.padding): LayoutNode[] {
    const collection = this.virtualizer!.collection;
    const offsetProperty = this.offsetProperty;
    const maxOffsetProperty = this.maxOffsetProperty;

    // Content nodes (Tree) don't affect the height.
    const collectionNodes = toArray(collection, (node) => node.type !== "content");
    const loaderNodes = collectionNodes.filter((node) => node.type === "loader");
    const nodes: LayoutNode[] = [];
    const isEmptyOrLoading = collection?.size === 0;
    if (isEmptyOrLoading) offset = 0;

    for (const node of collectionNodes) {
      const rowHeight = (this.rowSize ?? this.estimatedRowSize ?? DEFAULT_HEIGHT) + this.gap;
      // Skip rows before the valid rectangle unless they are already cached.
      if (node.type === "item" && offset + rowHeight < this.requestedRect[offsetProperty] && !this.isValid(node, offset)) {
        offset += rowHeight;
        continue;
      }

      const layoutNode =
        this.orientation === "horizontal" ? this.buildChild(node, offset, this.padding, null) : this.buildChild(node, this.padding, offset, null);
      offset = layoutNode.layoutInfo.rect[maxOffsetProperty] + this.gap;
      nodes.push(layoutNode);
      if (node.type === "loader") loaderNodes.splice(loaderNodes.indexOf(node), 1);

      // Build each loader outside the visible rect so they are persisted at the proper estimated location
      // (sections are always built to know their size).
      if ((node.type === "item" || node.type === "loader") && offset > this.requestedRect[maxOffsetProperty]) {
        let lastProcessedIndex = collectionNodes.indexOf(node);
        for (const loaderNode of loaderNodes) {
          const loaderNodeIndex = collectionNodes.indexOf(loaderNode);
          // Subtract an additional 1 since the current item's height is already added.
          offset += (loaderNodeIndex - lastProcessedIndex - 1) * rowHeight;
          const loader =
            this.orientation === "horizontal"
              ? this.buildChild(loaderNode, offset, this.padding, null)
              : this.buildChild(loaderNode, this.padding, offset, null);
          nodes.push(loader);
          offset = loader.layoutInfo.rect[maxOffsetProperty];
          lastProcessedIndex = loaderNodeIndex;
        }
        // The rest of the items after the last loader.
        offset += (collectionNodes.length - lastProcessedIndex - 1) * rowHeight;
        break;
      }
    }

    offset = Math.max(offset - this.gap, 0);
    offset += isEmptyOrLoading ? 0 : this.padding;
    this.contentSize = this.orientation === "horizontal" ? new Size(offset, this.virtualizer!.size.height) : new Size(this.virtualizer!.size.width, offset);
    return nodes;
  }

  protected isValid(node: Node<T>, offset: number): boolean {
    const cached = this.layoutNodes.get(node.key);
    return (
      !this.invalidateEverything &&
      !!cached &&
      cached.node === node &&
      offset === cached.layoutInfo.rect[this.offsetProperty] &&
      cached.layoutInfo.rect.intersects(this.validRect) &&
      cached.validRect.containsRect(cached.layoutInfo.rect.intersection(this.requestedRect))
    );
  }

  protected buildChild(node: Node<T>, x: number, y: number, parentKey: Key | null): LayoutNode {
    if (this.isValid(node, this.orientation === "horizontal" ? x : y)) return this.layoutNodes.get(node.key)!;
    const layoutNode = this.buildNode(node, x, y);
    layoutNode.layoutInfo.parentKey = parentKey ?? null;
    layoutNode.layoutInfo.allowOverflow = true;
    this.layoutNodes.set(node.key, layoutNode);
    return layoutNode;
  }

  protected buildNode(node: Node<T>, x: number, y: number): LayoutNode {
    switch (node.type) {
      case "section":
        return this.buildSection(node, x, y);
      case "item":
        return this.buildItem(node, x, y);
      case "header":
        return this.buildSectionHeader(node, x, y);
      case "loader":
        return this.buildLoader(node, x, y);
      case "separator":
        return this.buildItem(node, x, y);
      // A submenu trigger has a child node (the trigger) to process.
      case "submenutrigger":
        return this.buildSection(node, x, y);
      default:
        throw new Error("Unsupported node type: " + node.type);
    }
  }

  protected buildLoader(node: Node<T>, x: number, y: number): LayoutNode {
    const rect = new Rect(x, y, this.padding, 0);
    const layoutInfo = new LayoutInfo(node.type, node.key, rect);
    // An `isLoading` sentinel reserves room for the loader (also alongside an empty state).
    if (this.orientation === "horizontal") {
      rect.height = this.virtualizer!.contentSize.height - this.padding - y;
      rect.width = node.props.isLoading ? (this.loaderSize ?? this.rowSize ?? this.estimatedRowSize ?? DEFAULT_HEIGHT) : 0;
    } else {
      rect.width = this.virtualizer!.contentSize.width - this.padding - x;
      rect.height = node.props.isLoading ? (this.loaderSize ?? this.rowSize ?? this.estimatedRowSize ?? DEFAULT_HEIGHT) : 0;
    }
    return { layoutInfo, validRect: rect.intersection(this.requestedRect) };
  }

  protected buildSection(node: Node<T>, x: number, y: number): LayoutNode {
    const collection = this.virtualizer!.collection;
    const width = this.virtualizer!.size.width - this.padding - x;
    const height = this.virtualizer!.size.height - this.padding - y;
    const rect = this.orientation === "horizontal" ? new Rect(x, y, 0, height) : new Rect(x, y, width, 0);
    const layoutInfo = new LayoutInfo(node.type, node.key, rect);

    let offset = this.orientation === "horizontal" ? x : y;
    const offsetProperty = this.offsetProperty;
    const maxOffsetProperty = this.maxOffsetProperty;
    const heightProperty = this.sizeProperty;

    let skipped = 0;
    const children: LayoutNode[] = [];
    for (const child of getChildNodes(node, collection)) {
      // Content nodes (Tree) are skipped.
      if (child.type === "content") continue;
      const rowHeight = (this.rowSize ?? this.estimatedRowSize ?? DEFAULT_HEIGHT) + this.gap;

      // Skip rows before the valid rectangle unless they are already cached.
      if (offset + rowHeight < this.requestedRect[offsetProperty] && !this.isValid(node, offset)) {
        offset += rowHeight;
        skipped++;
        continue;
      }

      const layoutNode =
        this.orientation === "horizontal" ? this.buildChild(child, offset, y, layoutInfo.key) : this.buildChild(child, x, offset, layoutInfo.key);
      offset = layoutNode.layoutInfo.rect[maxOffsetProperty] + this.gap;
      children.push(layoutNode);

      if (offset > this.requestedRect[maxOffsetProperty]) {
        // Estimate the remaining height for rows that we don't need to layout right now.
        offset += ([...getChildNodes(node, collection)].length - (children.length + skipped)) * rowHeight;
        break;
      }
    }

    offset -= this.gap;
    rect[heightProperty] = offset - (this.orientation === "horizontal" ? x : y);

    return { layoutInfo, children, validRect: layoutInfo.rect.intersection(this.requestedRect), node };
  }

  protected buildSectionHeader(node: Node<T>, x: number, y: number): LayoutNode {
    const widthProperty = this.crossSizeProperty;
    const heightProperty = this.sizeProperty;
    const width = this.virtualizer!.size[widthProperty] - this.padding - (this.orientation === "horizontal" ? y : x);
    let rectHeight = this.headingSize;
    let isEstimated = false;

    // If no explicit height is available, use an estimated height.
    if (rectHeight == null) {
      // Reuse a previous height; estimated if the virtualizer size or the item content changed.
      const previousLayoutNode = this.layoutNodes.get(node.key);
      const previousLayoutInfo = previousLayoutNode?.layoutInfo;
      if (previousLayoutInfo) {
        const curNode = this.virtualizer!.collection.getItem(node.key);
        const lastNode = this.lastCollection ? this.lastCollection.getItem(node.key) : null;
        rectHeight = previousLayoutNode!.layoutInfo.rect[heightProperty];
        isEstimated = width !== previousLayoutInfo.rect[widthProperty] || curNode !== lastNode || previousLayoutInfo.estimatedSize;
      } else {
        rectHeight = node.rendered ? this.estimatedHeadingSize : 0;
        isEstimated = true;
      }
    }

    if (rectHeight == null) rectHeight = DEFAULT_HEIGHT;

    const headerRect = this.orientation === "horizontal" ? new Rect(x, y, rectHeight, width - y) : new Rect(x, y, width - x, rectHeight);
    const header = new LayoutInfo("header", node.key, headerRect);
    header.estimatedSize = isEstimated;
    return { layoutInfo: header, children: [], validRect: header.rect.intersection(this.requestedRect), node };
  }

  protected buildItem(node: Node<T>, x: number, y: number): LayoutNode {
    const widthProperty = this.crossSizeProperty;
    const heightProperty = this.sizeProperty;
    const width = this.virtualizer!.size[widthProperty] - this.padding - (this.orientation === "horizontal" ? y : x);
    let rectHeight = this.rowSize;
    let isEstimated = false;

    // If no explicit height is available, use an estimated height.
    if (rectHeight == null) {
      // Reuse a previous height; estimated if the virtualizer size or the item content changed.
      const previousLayoutNode = this.layoutNodes.get(node.key);
      if (previousLayoutNode) {
        rectHeight = previousLayoutNode.layoutInfo.rect[heightProperty];
        isEstimated =
          width !== previousLayoutNode.layoutInfo.rect[widthProperty] || node !== previousLayoutNode.node || previousLayoutNode.layoutInfo.estimatedSize;
      } else {
        rectHeight = this.estimatedRowSize;
        isEstimated = true;
      }
    }

    if (rectHeight == null) rectHeight = DEFAULT_HEIGHT;

    const rect = this.orientation === "horizontal" ? new Rect(x, y, rectHeight, width) : new Rect(x, y, width, rectHeight);
    const layoutInfo = new LayoutInfo(node.type, node.key, rect);
    layoutInfo.estimatedSize = isEstimated;
    return { layoutInfo, children: [], validRect: layoutInfo.rect.intersection(this.requestedRect), node };
  }

  override updateItemSize(key: Key, size: Size): boolean {
    const layoutNode = this.layoutNodes.get(key);
    // If no layoutInfo, item has been deleted/removed.
    if (!layoutNode) return false;

    const collection = this.virtualizer!.collection;
    const layoutInfo = layoutNode.layoutInfo;
    const offsetProperty = this.offsetProperty;
    const heightProperty = this.sizeProperty;
    layoutInfo.estimatedSize = false;
    if (layoutInfo.rect[heightProperty] !== size[heightProperty]) {
      // Copy layout info rather than mutating so that later caches are invalidated.
      const newLayoutInfo = layoutInfo.copy();
      newLayoutInfo.rect[heightProperty] = size[heightProperty];
      layoutNode.layoutInfo = newLayoutInfo;

      // Items after this one move: only items above stay valid.
      this.validRect[heightProperty] = Math.min(this.validRect[heightProperty], layoutInfo.rect[offsetProperty] - this.validRect[offsetProperty]);

      // The requestedRect also needs to account for the height difference.
      if (layoutNode.node?.type === "item") this.requestedRect[heightProperty] += newLayoutInfo.rect[heightProperty] - layoutInfo.rect[heightProperty];

      // Invalidate layout for this layout node and all parents.
      this.updateLayoutNode(key, layoutInfo, newLayoutInfo);
      let node = layoutInfo.parentKey != null ? collection.getItem(layoutInfo.parentKey) : null;
      while (node) {
        this.updateLayoutNode(node.key, layoutInfo, newLayoutInfo);
        node = node.parentKey != null ? collection.getItem(node.parentKey) : null;
      }
      return true;
    }
    return false;
  }

  private updateLayoutNode(key: Key, oldLayoutInfo: LayoutInfo, newLayoutInfo: LayoutInfo): void {
    const n = this.layoutNodes.get(key);
    if (n) {
      // Invalidate by intersecting the validRect of this node with the overall validRect.
      n.validRect = n.validRect.intersection(this.validRect);
      if (n.layoutInfo === oldLayoutInfo) n.layoutInfo = newLayoutInfo;
    }
  }

  getContentSize(): Size {
    return this.contentSize;
  }

  override getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null {
    x += this.virtualizer!.visibleRect.x;
    y += this.virtualizer!.visibleRect.y;

    // Find the closest item within on either side of the point using the gap width.
    const searchRect = new Rect(x, Math.max(0, y - this.gap), 1, Math.max(1, this.gap * 2));
    const candidates = this.getVisibleLayoutInfos(searchRect);
    let key: Key | null = null;
    let minDistance = Infinity;
    for (const candidate of candidates) {
      // Ignore items outside the search rect, e.g. persisted keys.
      if (!candidate.rect.intersects(searchRect)) continue;
      const dist = Math.min(Math.abs(candidate.rect.y - y), Math.abs(candidate.rect.maxY - y));
      if (dist < minDistance) {
        minDistance = dist;
        key = candidate.key;
      }
    }

    if (key == null || this.virtualizer!.collection.size === 0) return { type: "root" };

    const layoutInfo = this.getLayoutInfo(key);
    if (!layoutInfo) return null;

    const rect = layoutInfo.rect;
    const target: DropTarget = { type: "item", key: layoutInfo.key, dropPosition: "on" };

    // Dropping on the item not accepted: try before / after by y. Accepted: still before / after within
    // 10px of the top or bottom.
    if (!isValidDropTarget(target)) {
      if (y <= rect.y + rect.height / 2 && isValidDropTarget({ ...target, dropPosition: "before" })) target.dropPosition = "before";
      else if (isValidDropTarget({ ...target, dropPosition: "after" })) target.dropPosition = "after";
    } else if (y <= rect.y + 10 && isValidDropTarget({ ...target, dropPosition: "before" })) {
      target.dropPosition = "before";
    } else if (y >= rect.maxY - 10 && isValidDropTarget({ ...target, dropPosition: "after" })) {
      target.dropPosition = "after";
    }
    return target;
  }

  override getDropTargetLayoutInfo(target: ItemDropTarget): LayoutInfo {
    let layoutInfo = this.getLayoutInfo(target.key)!;
    let rect: Rect;
    const t = this.dropIndicatorThickness;
    if (target.dropPosition === "before") {
      rect =
        this.orientation === "horizontal"
          ? new Rect(Math.max(0, layoutInfo.rect.x - t / 2), layoutInfo.rect.y, t, layoutInfo.rect.height)
          : new Rect(layoutInfo.rect.x, Math.max(0, layoutInfo.rect.y - t / 2), layoutInfo.rect.width, t);
    } else if (target.dropPosition === "after") {
      // Render after the last visible descendant of the drop target.
      const targetNode = this.collection.getItem(target.key);
      if (targetNode) {
        const targetLevel = targetNode.level ?? 0;
        let currentKey = this.collection.getKeyAfter(target.key);
        while (currentKey != null) {
          const node = this.collection.getItem(currentKey);
          if (!node || node.level <= targetLevel) break;
          layoutInfo = this.getLayoutInfo(currentKey) || layoutInfo;
          currentKey = this.collection.getKeyAfter(currentKey);
        }
      }
      rect =
        this.orientation === "horizontal"
          ? new Rect(layoutInfo.rect.maxX - t / 2, layoutInfo.rect.y, t, layoutInfo.rect.height)
          : new Rect(layoutInfo.rect.x, layoutInfo.rect.maxY - t / 2, layoutInfo.rect.width, t);
    } else {
      rect = layoutInfo.rect;
    }
    return new LayoutInfo("dropIndicator", target.key + ":" + target.dropPosition, rect);
  }
}

function toArray<T>(collection: Collection<Node<T>>, predicate: (node: Node<T>) => boolean): Node<T>[] {
  const result: Node<T>[] = [];
  for (const node of collection) if (predicate(node)) result.push(node);
  return result;
}
