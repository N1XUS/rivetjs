// Rivet-authored (not a port): `MasonryLayout`, the virtualized layout of `@rivetjs/cdk/masonry`. Extends the
// react-stately `WaterfallLayout` port (`../virtualizer/waterfall-layout.ts`) and keeps its spatial keyboard delegate
// (`getKeyRightOf` / `getKeyLeftOf`) and drop target; replaces its sizing with `./layout.ts`:
// - columns from the masonry breakpoints at the virtualizer width, column width `(W − (n − 1)·gapX) / n`, no margins
//   (the same geometry as the server-placed mode, so switching `virtualize` keeps the picture);
// - items with a known aspect ratio are exact (`estimatedSize = false`: never measured); unknown ones start square
//   (+ extra) and take their measured height (`updateItemSize`), as WaterfallLayout's estimate → measure cycle;
// - column assignment = `placeColumns` (spans; per-breakpoint gaps) at the virtualizer width; `justified` options
//   place rows with `placeJustified` instead; `version` (a live span / ratio change) re-runs the layout.
// The aspect ratio reader is a constructor argument (a resumable function from the component), options are JSON.
import type { Key } from "../collections/index.ts";
import type { Node } from "../virtualizer/collection.ts";
import { LayoutInfo } from "../virtualizer/layout-info.ts";
import { Rect } from "../virtualizer/rect.ts";
import { Size } from "../virtualizer/size.ts";
import type { InvalidationContext } from "../virtualizer/types.ts";
import { WaterfallLayout } from "../virtualizer/waterfall-layout.ts";
import { rectsAt } from "./geometry.ts";
import { placeJustified, type JustifiedLastRow } from "./justified.ts";
import { breakpointAt, columnWidth, placeColumns, referenceWidths, responsiveAt, type Breakpoint, type Responsive } from "./layout.ts";

export interface MasonryLayoutOptions {
  /** Breakpoints (columns + `[column, row]` gaps per container width). */
  breakpoints: Breakpoint[];
  /** px added to every item (captions). */
  extra?: number;
  /** Greedy reference width override. */
  referenceWidth?: number | null;
  /** Loader height in px. Default 48. */
  loaderHeight?: number;
  /** Justified rows instead of columns (unknown ratios count as 1; spans = weights). */
  justified?: { rowHeight: Responsive<number>; tolerance?: number; minRowHeight?: number; maxRowHeight?: number; lastRow?: JustifiedLastRow } | null;
  /** Bumped by the component when live per-item inputs (spans, ratios) change: invalidates the layout. */
  version?: number;
}

export class MasonryLayout<T extends object> extends WaterfallLayout<T, any> {
  private infos = new Map<Key, LayoutInfo>();
  private measured = new Map<Key, number>();
  private size = new Size();
  /** Last placement as rects in collection order (keyboard geometry). */
  rects: { key: Key; rect: Rect }[] = [];

  private ratioOf: (item: T) => number | null;
  private spanOf: (item: T) => Responsive<number> | null | undefined;

  constructor(ratioOf: (item: T) => number | null, spanOf?: (item: T) => Responsive<number> | null | undefined) {
    super();
    this.ratioOf = ratioOf;
    this.spanOf = spanOf ?? (() => 1);
  }

  override shouldInvalidateLayoutOptions(next: MasonryLayoutOptions, prev: MasonryLayoutOptions): boolean {
    return JSON.stringify(next) !== JSON.stringify(prev);
  }

  /** Rects of `items` (key + value) at width `width` (keyboard geometry outside the window, tests). Pure. */
  rectsFor(items: readonly { key: Key; value: T }[], width: number, options: MasonryLayoutOptions): { key: Key; rect: Rect }[] {
    const { rects } = this.place(items, width, options);
    return items.map((item, i) => ({ key: item.key, rect: rects[i]! }));
  }

  private place(
    nodes: readonly { key: Key; value: T | null | undefined }[],
    width: number,
    options: MasonryLayoutOptions,
  ): { rects: Rect[]; exact: Uint8Array; columns: number } {
    const breakpoints = options.breakpoints?.length ? options.breakpoints : [{ min: 0, columns: 2, gap: [16, 16] as [number, number] }];
    const extra = options.extra ?? 0;
    const b = breakpointAt(breakpoints, width);
    const bp = breakpoints[b]!;
    const [gapX, gapY] = bp.gap;
    const n = options.justified ? 1 : bp.columns;
    const w = Math.max(0, columnWidth(width, n, gapX));
    const exact = new Uint8Array(nodes.length);
    let rects: Rect[];
    if (options.justified) {
      // Justified rows at the real width (client-only: no server picture to keep).
      const aspects = new Float64Array(nodes.length);
      nodes.forEach((node, i) => {
        const ratio = node.value ? this.ratioOf(node.value) : null;
        const weight = node.value ? responsiveAt(this.spanOf(node.value), bp.min, 1) : 1;
        aspects[i] = (ratio ?? 1) * Math.max(0.01, Number(weight) || 1);
        exact[i] = 1;
      });
      const j = options.justified;
      const g = placeJustified(aspects, width, {
        rowHeight: responsiveAt(j.rowHeight, bp.min, 240),
        tolerance: j.tolerance,
        minRowHeight: j.minRowHeight,
        maxRowHeight: j.maxRowHeight,
        lastRow: j.lastRow,
        gap: bp.gap,
      });
      rects = rectsAt(g, width).map((r) => new Rect(r.x, r.y, r.width, r.height));
    } else {
      const refW = columnWidth(referenceWidths(breakpoints, options.referenceWidth)[b]!, n, gapX);
      const alpha = new Float64Array(nodes.length);
      const beta = new Float64Array(nodes.length);
      const span = new Uint16Array(nodes.length);
      nodes.forEach((node, i) => {
        const ratio = node.value ? this.ratioOf(node.value) : null;
        const h = this.measured.get(node.key);
        span[i] = Math.max(1, Math.floor(Number(node.value ? responsiveAt(this.spanOf(node.value), bp.min, 1) : 1)) || 1);
        if (ratio) {
          alpha[i] = 1 / ratio;
          beta[i] = extra;
          exact[i] = 1;
        } else if (h != null) beta[i] = h;
        else {
          alpha[i] = 1;
          beta[i] = extra;
        }
      });
      const run = placeColumns({ alpha, beta, span }, n, refW, w, w, gapX, gapY);
      rects = rectsAt(run.geometry, w).map((r) => new Rect(r.x, r.y, r.width, r.height));
    }
    return { rects, exact, columns: n };
  }

  override update(context: InvalidationContext<MasonryLayoutOptions>): void {
    const options = (context.layoutOptions ?? {}) as MasonryLayoutOptions;
    const width = this.virtualizer!.size.width;
    if (context.sizeChanged) this.measured.clear();
    const collection = this.virtualizer!.collection;
    const nodes: Node<T>[] = [];
    let loader: Node<T> | null = null;
    for (const node of collection) {
      if (node.type === "loader") loader = node;
      else if (node.type === "item") nodes.push(node);
    }
    const { rects, exact, columns } = this.place(nodes, width, options);
    this.numColumns = columns;
    const infos = new Map<Key, LayoutInfo>();
    const keyed: { key: Key; rect: Rect }[] = [];
    let height = 0;
    nodes.forEach((node, i) => {
      const rect = rects[i]!;
      const info = new LayoutInfo(node.type, node.key, rect);
      info.estimatedSize = !exact[i] && !this.measured.has(node.key);
      info.allowOverflow = true;
      info.content = node;
      infos.set(node.key, info);
      keyed.push({ key: node.key, rect });
      if (rect.maxY > height) height = rect.maxY;
    });
    if (loader) {
      const loaderHeight = loader.props?.isLoading ? (options.loaderHeight ?? 48) : 0;
      const info = new LayoutInfo("loader", loader.key, new Rect(0, height, width, loaderHeight));
      infos.set(loader.key, info);
      height = info.rect.maxY;
    }
    this.infos = infos;
    this.rects = keyed;
    this.size = new Size(width, height);
  }

  override getLayoutInfo(key: Key): LayoutInfo {
    return this.infos.get(key)!;
  }

  override getContentSize(): Size {
    return this.size;
  }

  override getVisibleLayoutInfos(rect: Rect): LayoutInfo[] {
    const out: LayoutInfo[] = [];
    for (const info of this.infos.values())
      if (info.rect.intersects(rect) || this.virtualizer!.isPersistedKey(info.key) || info.type === "loader") out.push(info);
    return out;
  }

  override updateItemSize(key: Key, size: Size): boolean {
    const info = this.infos.get(key);
    if (!info || !size || !info.estimatedSize) return false;
    if (this.measured.get(key) === size.height) return false;
    this.measured.set(key, size.height);
    return true;
  }

  override getKeyRange(from: Key, to: Key): Key[] {
    const a = this.infos.get(from);
    const b = this.infos.get(to);
    if (!a || !b) return [];
    const rect = a.rect.union(b.rect);
    const keys: Key[] = [];
    for (const info of this.infos.values()) if (info.type === "item" && rect.intersection(info.rect).area > info.rect.area / 2) keys.push(info.key);
    return keys;
  }
}
