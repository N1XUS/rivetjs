// Ported from React Spectrum (react-stately/src/table/TableColumnLayout.ts + TableUtils.ts), Apache-2.0, © Adobe.
// Rivet: local module of the virtualizer (TableLayout's column widths); no dev warning for malformed widths.
import type { Key } from "../collections/index.ts";
import type { GridNode, TableCollection } from "./table-collection.ts";

/** A column width: px number, percentage (`"40%"`) or fraction (`"2fr"`). */
export type ColumnSize = number | `${number}%` | `${number}fr` | string;

// Numbers and percents are static; *fr units or a lack of units are dynamic.
export function isStatic(width?: ColumnSize | null): boolean {
  return width != null && (!isNaN(width as number) || String(width).match(/^(\d+)(?=%$)/) !== null);
}

export function parseFractionalUnit(width?: ColumnSize | null): number {
  if (!width || typeof width === "number") return 1;
  const match = width.match(/^(.+)(?=fr$)/);
  // An incorrect format defaults to 1fr.
  if (!match) return 1;
  return parseFloat(match[0]);
}

export function parseStaticWidth(width: number | string, tableWidth: number): number {
  if (typeof width === "string") {
    const match = width.match(/^(\d+)(?=%$)/);
    if (!match) throw new Error("Only percentages or numbers are supported for static column widths");
    return tableWidth * (parseFloat(match[0]) / 100);
  }
  return width;
}

export function getMaxWidth(maxWidth: number | string | null | undefined, tableWidth: number): number {
  return maxWidth != null ? parseStaticWidth(maxWidth, tableWidth) : Number.MAX_SAFE_INTEGER;
}

// Cannot support FR units: we'd need to know everything else in the table.
export function getMinWidth(minWidth: number | string, tableWidth: number): number {
  return minWidth != null ? parseStaticWidth(minWidth, tableWidth) : 0;
}

export interface IColumn {
  minWidth?: number | string;
  maxWidth?: number | string;
  width?: number | string;
  defaultWidth?: number | string;
  key: Key;
}

interface FlexItem {
  frozen: boolean;
  baseSize: number;
  hypotheticalMainSize: number;
  min: number;
  max: number;
  flex: number;
  targetMainSize: number;
  violation: number;
}

/**
 * The flex algorithm of https://www.w3.org/TR/css-flexbox-1/#layout-algorithm for one row of columns: basis 0
 * unless static, grow = shrink = the column's fr; whole-pixel widths via cascade rounding (the sum is kept).
 */
export function calculateColumnSizes(
  availableWidth: number,
  columns: IColumn[],
  changedColumns: Map<Key, ColumnSize>,
  getDefaultWidth?: (index: number) => ColumnSize | null | undefined,
  getDefaultMinWidth?: (index: number) => ColumnSize | null | undefined,
): number[] {
  const originalWidth = availableWidth;
  const flooredWidth = Math.floor(availableWidth);
  const hasFractionalWidth = availableWidth - flooredWidth > 0;
  availableWidth = flooredWidth;
  let hasNonFrozenItems = false;
  const flexItems: FlexItem[] = columns.map((column, index) => {
    const width: ColumnSize = (
      changedColumns.get(column.key) != null
        ? (changedColumns.get(column.key) ?? "1fr")
        : (column.width ?? column.defaultWidth ?? getDefaultWidth?.(index) ?? "1fr")
    ) as ColumnSize;
    let frozen = false;
    let baseSize = 0;
    let flex = 0;
    let targetMainSize = 0;
    if (isStatic(width)) {
      baseSize = parseStaticWidth(width, availableWidth);
      frozen = true;
    } else {
      flex = parseFractionalUnit(width);
      if (flex <= 0) frozen = true;
    }

    const min = getMinWidth(column.minWidth ?? (getDefaultMinWidth?.(index) as number | string) ?? 0, availableWidth);
    const max = getMaxWidth(column.maxWidth, availableWidth);
    const hypotheticalMainSize = Math.max(min, Math.min(baseSize, max));

    // 9.7.1 / 9.7.2: flex basis is always 0, so always in 'grow' mode.
    if (frozen) {
      targetMainSize = hypotheticalMainSize;
    } else if (baseSize > hypotheticalMainSize) {
      frozen = true;
      targetMainSize = hypotheticalMainSize;
    }

    // 9.7.3
    if (!frozen) hasNonFrozenItems = true;
    return { frozen, baseSize, hypotheticalMainSize, min, max, flex, targetMainSize, violation: 0 };
  });

  // 9.7.4
  while (hasNonFrozenItems) {
    // 9.7.4.b: remaining free space.
    let usedWidth = 0;
    let flexFactors = 0;
    for (const item of flexItems) {
      if (item.frozen) {
        usedWidth += item.targetMainSize;
      } else {
        usedWidth += item.baseSize;
        flexFactors += item.flex;
      }
    }
    const remainingFreeSpace = availableWidth - usedWidth;

    // 9.7.4.c: distribute the free space proportionally to the flex factors (integer fr only).
    if (remainingFreeSpace > 0) {
      for (const item of flexItems) if (!item.frozen) item.targetMainSize = item.baseSize + (item.flex / flexFactors) * remainingFreeSpace;
    }

    // 9.7.4.d: fix min/max violations.
    let totalViolation = 0;
    for (const item of flexItems) {
      item.violation = 0;
      if (!item.frozen) {
        const { min, max, targetMainSize } = item;
        item.targetMainSize = Math.max(min, Math.min(targetMainSize, max));
        item.violation = item.targetMainSize - targetMainSize;
        totalViolation += item.violation;
      }
    }

    // 9.7.4.e: freeze over-flexed items (zero: all; positive: min violations; negative: max violations).
    hasNonFrozenItems = false;
    for (const item of flexItems) {
      if (totalViolation === 0 || Math.sign(totalViolation) === Math.sign(item.violation)) item.frozen = true;
      else if (!item.frozen) hasNonFrozenItems = true;
    }
  }

  const columnSizes = cascadeRounding(flexItems);

  // The leftover sub-pixel width goes to the last column, so the columns sum to the available width.
  if (hasFractionalWidth && columnSizes.length > 0) {
    const tableFractionalWidth = originalWidth.toString().split(".")[1];
    const columnWidth = columnSizes[columnSizes.length - 1]!.toString();
    columnSizes[columnSizes.length - 1] = Number(columnWidth + "." + tableFractionalWidth);
  }
  return columnSizes;
}

/** Rounds floats summing to an integer into integers with the same sum. */
function cascadeRounding(flexItems: FlexItem[]): number[] {
  let fpTotal = 0;
  let intTotal = 0;
  const roundedArray: number[] = [];
  for (const item of flexItems) {
    const float = item.targetMainSize;
    const integer = Math.round(float + fpTotal) - intTotal;
    fpTotal += float;
    intTotal += integer;
    roundedArray.push(integer);
  }
  return roundedArray;
}

export interface TableColumnLayoutOptions<T> {
  getDefaultWidth?: (column: GridNode<T>) => ColumnSize | null | undefined;
  getDefaultMinWidth?: (column: GridNode<T>) => ColumnSize | null | undefined;
}

export class TableColumnLayout<T> {
  getDefaultWidth: (column: GridNode<T>) => ColumnSize | null | undefined;
  getDefaultMinWidth: (column: GridNode<T>) => ColumnSize | null | undefined;
  columnWidths: Map<Key, number> = new Map();
  columnMinWidths: Map<Key, number> = new Map();
  columnMaxWidths: Map<Key, number> = new Map();

  constructor(options: TableColumnLayoutOptions<T>) {
    this.getDefaultWidth = options?.getDefaultWidth ?? (() => "1fr");
    this.getDefaultMinWidth = options?.getDefaultMinWidth ?? (() => 75);
  }

  /** Splits columns into controlled (`props.width`) and uncontrolled ones. */
  splitColumnsIntoControlledAndUncontrolled(columns: Array<GridNode<T>>): [Map<Key, GridNode<T>>, Map<Key, GridNode<T>>] {
    return columns.reduce(
      (acc, col) => {
        if (col.props.width != null) acc[0].set(col.key, col);
        else acc[1].set(col.key, col);
        return acc;
      },
      [new Map(), new Map()] as [Map<Key, GridNode<T>>, Map<Key, GridNode<T>>],
    );
  }

  /** Joins uncontrolled and controlled widths into a single Map. */
  recombineColumns(
    columns: Array<GridNode<T>>,
    uncontrolledWidths: Map<Key, ColumnSize>,
    uncontrolledColumns: Map<Key, GridNode<T>>,
    controlledColumns: Map<Key, GridNode<T>>,
  ): Map<Key, ColumnSize> {
    return new Map(
      columns.map((col) => [col.key, uncontrolledColumns.has(col.key) ? uncontrolledWidths.get(col.key)! : controlledColumns.get(col.key)!.props.width]),
    );
  }

  /** Initial Map of the uncontrolled widths based on default widths. */
  getInitialUncontrolledWidths(uncontrolledColumns: Map<Key, GridNode<T>>): Map<Key, ColumnSize> {
    return new Map(Array.from(uncontrolledColumns).map(([key, col]) => [key, col.props.defaultWidth ?? this.getDefaultWidth?.(col) ?? "1fr"]));
  }

  getColumnWidth(key: Key): number {
    return this.columnWidths.get(key) ?? 0;
  }

  getColumnMinWidth(key: Key): number {
    return this.columnMinWidths.get(key) ?? 0;
  }

  getColumnMaxWidth(key: Key): number {
    return this.columnMaxWidths.get(key) ?? 0;
  }

  resizeColumnWidth(collection: TableCollection<T>, uncontrolledWidths: Map<Key, ColumnSize>, col: Key, width: number): Map<Key, ColumnSize> {
    const prevColumnWidths = this.columnWidths;
    let freeze = true;
    const newWidths = new Map<Key, ColumnSize>();
    width = Math.max(this.getColumnMinWidth(col), Math.min(this.getColumnMaxWidth(col), Math.floor(width)));
    for (const column of collection.columns) {
      if (column.key === col) {
        newWidths.set(column.key, width);
        freeze = false;
      } else if (freeze) {
        // Freeze columns to the left to their previous pixel value.
        newWidths.set(column.key, prevColumnWidths.get(column.key) ?? 0);
      } else {
        newWidths.set(column.key, column.props.width ?? uncontrolledWidths.get(column.key));
      }
    }
    return newWidths;
  }

  buildColumnWidths(tableWidth: number, collection: TableCollection<T>, widths: Map<Key, ColumnSize>): Map<Key, number> {
    this.columnWidths = new Map();
    this.columnMinWidths = new Map();
    this.columnMaxWidths = new Map();

    // Initial layout or table/window resizing.
    const columnWidths = calculateColumnSizes(
      tableWidth,
      collection.columns.map((col) => ({ ...col.props, key: col.key })),
      widths,
      (i) => this.getDefaultWidth(collection.columns[i]!),
      (i) => this.getDefaultMinWidth(collection.columns[i]!),
    );

    // Columns going in are in the same order as the columns coming out.
    columnWidths.forEach((width, index) => {
      const column = collection.columns[index]!;
      const key = column.key;
      this.columnWidths.set(key, width);
      this.columnMinWidths.set(key, getMinWidth((column.props.minWidth ?? this.getDefaultMinWidth(column)) as number | string, tableWidth));
      this.columnMaxWidths.set(key, getMaxWidth(column.props.maxWidth, tableWidth));
    });
    return this.columnWidths;
  }
}
