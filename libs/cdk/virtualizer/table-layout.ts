// Ported from React Spectrum (react-stately/src/layout/TableLayout.ts), Apache-2.0, © Adobe.
import type { Key } from "../collections/index.ts";
import { getChildNodes } from "./collection.ts";
import { LayoutInfo } from "./layout-info.ts";
import { type LayoutNode, ListLayout, type ListLayoutOptions } from "./list-layout.ts";
import type { Point } from "./point.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { GridNode, TableCollection } from "./table-collection.ts";
import { TableColumnLayout } from "./table-column-layout.ts";
import type { DropTarget, InvalidationContext, ItemDropTarget } from "./types.ts";

export interface TableLayoutProps extends Omit<
  ListLayoutOptions,
  "orientation" | "rowSize" | "estimatedRowSize" | "headingSize" | "estimatedHeadingSize" | "loaderSize"
> {
  /** The fixed height of a row in px. Default 48. */
  rowHeight?: number;
  /** The estimated height of a row, when row heights are variable. */
  estimatedRowHeight?: number;
  /** The fixed height of a section header (column header row) in px. Default 48. */
  headingHeight?: number;
  /** The estimated height of a section header, when the height is variable. */
  estimatedHeadingHeight?: number;
  /** The fixed height of a "load more" loader element in px. Default 48. */
  loaderHeight?: number;
  /** Column widths (px) by column key, e.g. from column resizing; computed from the columns otherwise. */
  columnWidths?: Map<Key, number>;
}

const DEFAULT_ROW_HEIGHT = 48;

/** Arranges items in rows and columns (sticky header, row groups, per-cell virtualization along x). */
export class TableLayout<T, O extends TableLayoutProps = TableLayoutProps> extends ListLayout<T, O> {
  protected override lastCollection: TableCollection<T> | null = null;
  private columnWidths: Map<Key, number> = new Map();
  private stickyColumnIndices: number[];
  private lastPersistedKeys: Set<Key> | null = null;
  private persistedIndices: Map<Key, number[]> = new Map();

  constructor(options?: TableLayoutProps) {
    super(options);
    this.stickyColumnIndices = [];
  }

  // Backward compatibility for subclassing.
  protected override get collection(): TableCollection<T> {
    return this.virtualizer!.collection as unknown as TableCollection<T>;
  }

  private get table(): TableCollection<T> {
    return this.virtualizer!.collection as unknown as TableCollection<T>;
  }

  private columnsChanged(newCollection: TableCollection<T>, oldCollection: TableCollection<T> | null): boolean {
    return (
      !oldCollection ||
      (newCollection.columns !== oldCollection.columns && newCollection.columns.length !== oldCollection.columns.length) ||
      newCollection.columns.some(
        (c, i) =>
          c.key !== oldCollection.columns[i]!.key ||
          c.props.width !== oldCollection.columns[i]!.props.width ||
          c.props.minWidth !== oldCollection.columns[i]!.props.minWidth ||
          c.props.maxWidth !== oldCollection.columns[i]!.props.maxWidth,
      )
    );
  }

  override shouldInvalidateLayoutOptions(newOptions: O, oldOptions: O): boolean {
    return newOptions.columnWidths !== oldOptions.columnWidths || super.shouldInvalidateLayoutOptions(newOptions, oldOptions);
  }

  override update(invalidationContext: InvalidationContext<O>): void {
    const newCollection = this.table;

    // Column widths from layoutOptions, else computed here.
    if (invalidationContext.layoutOptions?.columnWidths) {
      for (const [key, val] of invalidationContext.layoutOptions.columnWidths) {
        if (this.columnWidths.get(key) !== val) {
          this.columnWidths = invalidationContext.layoutOptions.columnWidths;
          invalidationContext.sizeChanged = true;
          break;
        }
      }
    } else if (invalidationContext.sizeChanged || this.columnsChanged(newCollection, this.lastCollection)) {
      const columnLayout = new TableColumnLayout<T>({});
      this.columnWidths = columnLayout.buildColumnWidths(this.virtualizer!.size.width - this.padding * 2, newCollection, new Map());
      invalidationContext.sizeChanged = true;
    }

    super.update(invalidationContext);
  }

  protected override buildCollection(): LayoutNode[] {
    this.stickyColumnIndices = [];

    const collection = this.table;
    for (const column of collection.columns) {
      // Sticky columns (selection cell) always need to be visible; row headers stay in the DOM for labeling.
      if (this.isStickyColumn(column) || collection.rowHeaderColumnKeys.has(column.key)) this.stickyColumnIndices.push(column.index);
    }

    let layoutNodes: LayoutNode[] = [];
    let y = 0;
    let width = 0;

    if (!collection.head) {
      const header = this.buildTableHeader();
      this.layoutNodes.set(header.layoutInfo.key, header);
      const body = this.buildBody(header.layoutInfo.rect.maxY + this.gap);
      body.layoutInfo.rect.width = Math.max(header.layoutInfo.rect.width, body.layoutInfo.rect.width);
      y = body.layoutInfo.rect.maxY;
      width = body.layoutInfo.rect.width;
      layoutNodes = [header, body];
    } else {
      for (const node of collection) {
        switch (node.type) {
          case "tableheader": {
            const header = this.buildTableHeader();
            y = header.layoutInfo.rect.maxY + this.gap;
            width = Math.max(width, header.layoutInfo.rect.width);
            this.layoutNodes.set(header.layoutInfo.key, header);
            layoutNodes.push(header);
            break;
          }
          case "tablebody":
          case "tablefooter": {
            const body = this.buildRowGroup(y, node);
            y = body.layoutInfo.rect.maxY + this.gap;
            width = Math.max(width, body.layoutInfo.rect.width);
            this.layoutNodes.set(body.layoutInfo.key, body);
            layoutNodes.push(body);
            break;
          }
        }
      }
      if (y > 0) y -= this.gap;
      for (const layoutNode of layoutNodes) layoutNode.layoutInfo.rect.width = width;
    }

    this.lastPersistedKeys = null;
    this.contentSize = new Size(width + this.padding * 2, y + this.padding);
    return layoutNodes;
  }

  protected buildTableHeader(): LayoutNode {
    const collection = this.table;
    const rect = new Rect(this.padding, this.padding, 0, 0);
    const layoutInfo = new LayoutInfo("header", collection.head?.key ?? "header", rect);
    layoutInfo.isSticky = true;
    layoutInfo.zIndex = 1;

    let y = this.padding;
    let width = 0;
    const children: LayoutNode[] = [];
    for (const headerRow of collection.headerRows) {
      const layoutNode = this.buildChild(headerRow, this.padding, y, layoutInfo.key);
      layoutNode.layoutInfo.parentKey = layoutInfo.key;
      y = layoutNode.layoutInfo.rect.maxY;
      width = Math.max(width, layoutNode.layoutInfo.rect.width);
      layoutNode.index = children.length;
      children.push(layoutNode);
    }

    rect.width = width;
    rect.height = y - this.padding;
    return { layoutInfo, children, validRect: layoutInfo.rect, node: collection.head };
  }

  protected buildHeaderRow(headerRow: GridNode<T>, x: number, y: number): LayoutNode {
    const rect = new Rect(x, y, 0, 0);
    const row = new LayoutInfo("headerrow", headerRow.key, rect);

    let height = 0;
    const columns: LayoutNode[] = [];
    for (const cell of getChildNodes(headerRow, this.virtualizer!.collection)) {
      const layoutNode = this.buildChild(cell, x, y, row.key);
      layoutNode.layoutInfo.parentKey = row.key;
      x = layoutNode.layoutInfo.rect.maxX;
      height = Math.max(height, layoutNode.layoutInfo.rect.height);
      layoutNode.index = columns.length;
      columns.push(layoutNode);
    }
    for (const [i, layout] of columns.entries()) layout.layoutInfo.zIndex = columns.length - i + 1;

    this.setChildHeights(columns, height);
    rect.height = height;
    rect.width = x - rect.x;
    return { layoutInfo: row, children: columns, validRect: rect, node: headerRow };
  }

  private setChildHeights(children: LayoutNode[], height: number): void {
    for (const child of children) {
      if (child.layoutInfo.rect.height !== height) {
        // Copy the layout info before mutating it.
        child.layoutInfo = child.layoutInfo.copy();
        child.layoutInfo.rect.height = height;
      }
    }
  }

  // Column widths when rendering to the DOM.
  private getRenderedColumnWidth(node: GridNode<T>): number {
    const collection = this.table;
    const colSpan = node.colSpan ?? 1;
    const colIndex = node.colIndex ?? node.index;
    let width = 0;
    for (let i = colIndex; i < colIndex + colSpan; i++) {
      const column = collection.columns[i];
      if (column?.key != null) width += this.columnWidths.get(column.key) ?? 0;
    }
    return width;
  }

  private getEstimatedHeight(
    node: GridNode<T>,
    width: number,
    height: number | null,
    estimatedHeight: number | null,
  ): { height: number; isEstimated: boolean } {
    let isEstimated = false;
    // If no explicit height is available, use an estimated height.
    if (height == null) {
      // Reuse a previous height; estimated if the collection view size or the item content changed.
      const previousLayoutNode = this.layoutNodes.get(node.key);
      if (previousLayoutNode) {
        height = previousLayoutNode.layoutInfo.rect.height;
        isEstimated = node !== previousLayoutNode.node || width !== previousLayoutNode.layoutInfo.rect.width || previousLayoutNode.layoutInfo.estimatedSize;
      } else {
        height = estimatedHeight ?? DEFAULT_ROW_HEIGHT;
        isEstimated = true;
      }
    }
    return { height, isEstimated };
  }

  protected getEstimatedRowHeight(): number {
    return this.rowHeight ?? this.estimatedRowHeight ?? DEFAULT_ROW_HEIGHT;
  }

  protected buildColumn(node: GridNode<T>, x: number, y: number): LayoutNode {
    const width = this.getRenderedColumnWidth(node);
    const { height, isEstimated } = this.getEstimatedHeight(
      node,
      width,
      this.headingHeight ?? this.rowHeight,
      this.estimatedHeadingHeight ?? this.estimatedRowHeight,
    );
    const layoutInfo = new LayoutInfo(node.type, node.key, new Rect(x, y, width, height));
    layoutInfo.isSticky = this.isStickyColumn(node);
    layoutInfo.zIndex = layoutInfo.isSticky ? 2 : 1;
    layoutInfo.estimatedSize = isEstimated;
    return { layoutInfo, children: [], validRect: layoutInfo.rect, node };
  }

  // For subclasses.
  protected isStickyColumn(_node: GridNode<T>): boolean {
    return false;
  }

  protected buildBody(y: number): LayoutNode {
    return this.buildRowGroup(y, this.table.body);
  }

  protected buildRowGroup(y: number, node: GridNode<T>): LayoutNode {
    const collection = this.table;
    const rect = new Rect(this.padding, y, 0, 0);
    const layoutInfo = new LayoutInfo("rowgroup", node.key, rect);

    const startY = y;
    let width = 0;
    const children: LayoutNode[] = [];
    const rowHeight = this.getEstimatedRowHeight() + this.gap;
    for (const child of getChildNodes(node, collection)) {
      // Skip rows outside the valid rectangle unless they are already cached.
      if ((y + rowHeight < this.requestedRect.y && !this.isValid(child, y)) || (y > this.requestedRect.maxY && child.type !== "loader")) {
        y += rowHeight;
        continue;
      }
      const layoutNode = this.buildChild(child, this.padding, y, layoutInfo.key);
      layoutNode.layoutInfo.parentKey = layoutInfo.key;
      layoutNode.index = children.length;
      y = layoutNode.layoutInfo.rect.maxY + this.gap;
      width = Math.max(width, layoutNode.layoutInfo.rect.width);
      children.push(layoutNode);
    }

    // The table body gets a height when empty or performing the initial load.
    if (collection?.size === 0) y = this.virtualizer!.size.height;
    else y -= this.gap;

    rect.width = width;
    rect.height = y - startY;
    return { layoutInfo, children, validRect: layoutInfo.rect.intersection(this.requestedRect), node };
  }

  protected override buildLoader(node: GridNode<T>, x: number, y: number): LayoutNode {
    const layoutNode = super.buildLoader(node, x, y);
    // Same approach as buildRow for the loader width (else outdated).
    layoutNode.layoutInfo.rect.width = this.layoutNodes.get(this.table.head?.key ?? "header")!.layoutInfo.rect.width;
    layoutNode.validRect = layoutNode.layoutInfo.rect.intersection(this.requestedRect);
    return layoutNode;
  }

  protected override buildNode(node: GridNode<T>, x: number, y: number): LayoutNode {
    switch (node.type) {
      case "headerrow":
        return this.buildHeaderRow(node, x, y);
      case "item":
        return this.buildRow(node, x, y);
      case "column":
      case "placeholder":
        return this.buildColumn(node, x, y);
      case "cell":
        return this.buildCell(node, x, y);
      case "loader":
        return this.buildLoader(node, x, y);
      default:
        throw new Error("Unknown node type " + node.type);
    }
  }

  protected buildRow(node: GridNode<T>, x: number, y: number): LayoutNode {
    const collection = this.table;
    const rect = new Rect(x, y, 0, 0);
    const layoutInfo = new LayoutInfo("row", node.key, rect);

    const children: LayoutNode[] = [];
    let height = 0;
    for (const child of getChildNodes(node, collection)) {
      if (child.type !== "cell") continue;
      if (x > this.requestedRect.maxX) {
        // Move an existing cached layoutInfo out of view (column resizing).
        const layoutNode = this.layoutNodes.get(child.key);
        if (layoutNode) {
          layoutNode.layoutInfo.rect.x = x;
          x += layoutNode.layoutInfo.rect.width;
        } else {
          break;
        }
      } else {
        const layoutNode = this.buildChild(child, x, y, layoutInfo.key);
        x = layoutNode.layoutInfo.rect.maxX;
        height = Math.max(height, layoutNode.layoutInfo.rect.height);
        layoutNode.index = children.length;
        children.push(layoutNode);
      }
    }

    this.setChildHeights(children, height);
    rect.width = this.layoutNodes.get(collection.head?.key ?? "header")!.layoutInfo.rect.width;
    rect.height = height;
    return { layoutInfo, children, validRect: rect.intersection(this.requestedRect), node };
  }

  protected buildCell(node: GridNode<T>, x: number, y: number): LayoutNode {
    const width = this.getRenderedColumnWidth(node);
    const { height, isEstimated } = this.getEstimatedHeight(node, width, this.rowHeight, this.estimatedRowHeight);
    const rect = new Rect(x, y, width, height);
    const layoutInfo = new LayoutInfo(node.type, node.key, rect);
    layoutInfo.isSticky = this.isStickyColumn(node);
    layoutInfo.zIndex = layoutInfo.isSticky ? 2 : 1;
    layoutInfo.estimatedSize = isEstimated;
    return { layoutInfo, children: [], validRect: rect, node };
  }

  override getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    // Keep the number of visible rows consistent (only if > 1 px, for getDropTargetFromPoint).
    if (rect.height > 1) {
      const rowHeight = this.getEstimatedRowHeight();
      // Mutates `rect` like the original (getDropTargetFromPoint then tests candidates against the snapped rect).
      rect.y = Math.floor(rect.y / rowHeight) * rowHeight;
      rect.height = Math.ceil(rect.height / rowHeight) * rowHeight;
    }

    // If layout hasn't yet been done for the requested rect, union it with the valid rect, and recompute.
    this.layoutIfNeeded(rect);

    const res: LayoutInfo[] = [];
    this.buildPersistedIndices();
    for (const node of this.rootNodes) {
      res.push(node.layoutInfo);
      this.addVisibleLayoutInfos(res, node, rect);
    }
    return res;
  }

  private addVisibleLayoutInfos(res: LayoutInfo[], node: LayoutNode, rect: Rect): void {
    if (!node.children || node.children.length === 0) return;

    switch (node.layoutInfo.type) {
      case "header": {
        for (const child of node.children) {
          res.push(child.layoutInfo);
          this.addVisibleLayoutInfos(res, child, rect);
        }
        break;
      }
      case "rowgroup": {
        const firstVisibleRow = this.binarySearch(node.children, rect.topLeft, "y");
        const lastVisibleRow = this.binarySearch(node.children, rect.bottomRight, "y");

        // Persisted rows before the visible rows.
        const persistedRowIndices = this.persistedIndices.get(node.layoutInfo.key);
        let persistIndex = 0;
        while (persistedRowIndices && persistIndex < persistedRowIndices.length && persistedRowIndices[persistIndex]! < firstVisibleRow) {
          const idx = persistedRowIndices[persistIndex]!;
          if (idx < node.children.length) {
            res.push(node.children[idx]!.layoutInfo);
            this.addVisibleLayoutInfos(res, node.children[idx]!, rect);
          }
          persistIndex++;
        }

        for (let i = firstVisibleRow; i <= lastVisibleRow; i++) {
          // Skip persisted rows that overlap with visible cells.
          while (persistedRowIndices && persistIndex < persistedRowIndices.length && persistedRowIndices[persistIndex]! < i) persistIndex++;
          res.push(node.children[i]!.layoutInfo);
          this.addVisibleLayoutInfos(res, node.children[i]!, rect);
        }

        // Persisted rows after the visible rows.
        while (persistedRowIndices && persistIndex < persistedRowIndices.length) {
          const idx = persistedRowIndices[persistIndex++]!;
          if (idx < node.children.length) {
            res.push(node.children[idx]!.layoutInfo);
            this.addVisibleLayoutInfos(res, node.children[idx]!, rect);
          }
        }

        // Always include the loading sentinel (assumed to be the last child).
        const lastRow = node.children.at(-1);
        if (lastRow?.layoutInfo.type === "loader") res.push(lastRow.layoutInfo);
        break;
      }
      case "headerrow":
      case "row": {
        const firstVisibleCell = this.binarySearch(node.children, rect.topLeft, "x");
        const lastVisibleCell = this.binarySearch(node.children, rect.topRight, "x");
        let stickyIndex = 0;

        // Persisted / sticky cells before the visible cells.
        const persistedCellIndices = this.persistedIndices.get(node.layoutInfo.key) || this.stickyColumnIndices;
        while (stickyIndex < persistedCellIndices.length && persistedCellIndices[stickyIndex]! < firstVisibleCell) {
          const idx = persistedCellIndices[stickyIndex]!;
          if (idx < node.children.length) res.push(node.children[idx]!.layoutInfo);
          stickyIndex++;
        }

        for (let i = firstVisibleCell; i <= lastVisibleCell; i++) {
          // Skip sticky cells that overlap with visible cells.
          while (stickyIndex < persistedCellIndices.length && persistedCellIndices[stickyIndex]! < i) stickyIndex++;
          res.push(node.children[i]!.layoutInfo);
        }

        // Remaining sticky cells after the visible cells.
        while (stickyIndex < persistedCellIndices.length) {
          const idx = persistedCellIndices[stickyIndex++]!;
          if (idx < node.children.length) res.push(node.children[idx]!.layoutInfo);
        }
        break;
      }
      default:
        throw new Error("Unknown node type " + node.layoutInfo.type);
    }
  }

  private binarySearch(items: LayoutNode[], point: Point, axis: "x" | "y"): number {
    let low = 0;
    let high = items.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const item = items[mid]!;
      if ((axis === "x" && item.layoutInfo.rect.maxX <= point.x) || (axis === "y" && item.layoutInfo.rect.maxY <= point.y)) low = mid + 1;
      else if ((axis === "x" && item.layoutInfo.rect.x > point.x) || (axis === "y" && item.layoutInfo.rect.y > point.y)) high = mid - 1;
      else return mid;
    }
    return Math.max(0, Math.min(items.length - 1, low));
  }

  private buildPersistedIndices(): void {
    if (this.virtualizer!.persistedKeys === this.lastPersistedKeys) return;
    this.lastPersistedKeys = this.virtualizer!.persistedKeys;
    this.persistedIndices.clear();

    // parentKey => indices of children to persist.
    for (const key of this.virtualizer!.persistedKeys) {
      let layoutInfo = this.layoutNodes.get(key)?.layoutInfo;
      // Walk up ancestors so parents are also persisted if children are.
      while (layoutInfo && layoutInfo.parentKey) {
        const collectionNode = this.virtualizer!.collection.getItem(layoutInfo.key);
        let indices = this.persistedIndices.get(layoutInfo.parentKey);
        if (!indices) {
          // Sticky columns are always persisted along with any cells from persistedKeys.
          indices = collectionNode?.type === "cell" || collectionNode?.type === "column" ? [...this.stickyColumnIndices] : [];
          this.persistedIndices.set(layoutInfo.parentKey, indices);
        }
        const index = this.layoutNodes.get(layoutInfo.key)?.index;
        if (index != null && !indices.includes(index)) indices.push(index);
        layoutInfo = this.layoutNodes.get(layoutInfo.parentKey)?.layoutInfo;
      }
    }

    for (const indices of this.persistedIndices.values()) indices.sort((a, b) => a - b);
  }

  override getDropTargetFromPoint(x: number, y: number, isValidDropTarget: (target: DropTarget) => boolean): DropTarget | null {
    x += this.virtualizer!.visibleRect.x;
    y += this.virtualizer!.visibleRect.y;

    // Find the closest row within on either side of the point using the gap width.
    const searchRect = new Rect(x, Math.max(0, y - this.gap), 1, Math.max(1, this.gap * 2));
    let key: Key | null = null;
    let minDistance = Infinity;
    for (const candidate of this.getVisibleLayoutInfos(searchRect)) {
      // Ignore items outside the search rect, e.g. persisted keys.
      if (candidate.type !== "row" || !candidate.rect.intersects(searchRect)) continue;
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
    const layoutInfo = super.getDropTargetLayoutInfo(target);
    layoutInfo.parentKey = this.virtualizer!.collection.getItem(target.key)?.parentKey ?? null;
    return layoutInfo;
  }
}
