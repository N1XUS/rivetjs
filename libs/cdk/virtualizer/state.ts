// Ported from React Spectrum (react-stately/src/virtualizer/useVirtualizerState.ts), Apache-2.0, © Adobe.
// Rivet: signals instead of hooks — `createVirtualizerState` owns one effect that renders the engine whenever
// the visible rect, size, scrolling flag, invalidation context or a reactive option changes. Browser-side
// (or test) only: the state holds class instances, never serialize it.
import { createRoot, effect, signal, untrack } from "@rivetjs/reactivity";
import type { Key } from "../collections/index.ts";
import type { Collection } from "./collection.ts";
import type { Layout } from "./layout.ts";
import { Rect } from "./rect.ts";
import type { ReusableView } from "./reusable-view.ts";
import { Size } from "./size.ts";
import type { InvalidationContext } from "./types.ts";
import { Virtualizer } from "./virtualizer-core.ts";

/** A value or an accessor (read inside the render effect, so signals in it re-render). */
export type MaybeAccessor<T> = T | (() => T);
const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

export interface VirtualizerStateOptions<T extends object, V, O> {
  renderView(type: string, content: T | null): V;
  layout: MaybeAccessor<Layout<T>>;
  collection: MaybeAccessor<Collection<T>>;
  onVisibleRectChange(rect: Rect): void;
  persistedKeys?: MaybeAccessor<Set<Key> | null | undefined>;
  layoutOptions?: MaybeAccessor<O | undefined>;
  allowsWindowScrolling?: boolean;
  /** Rivet: start from a measured rect (default empty, like the original) so the first render keeps its views. */
  initialVisibleRect?: Rect;
}

export interface VirtualizerState<T extends object, V> {
  /** Root views (each with `children`), re-read after every render. */
  visibleViews(): ReusableView<T, V>[];
  setVisibleRect(rect: Rect): void;
  size(): Size;
  setSize(size: Size): void;
  contentSize(): Size;
  virtualizer: Virtualizer<T, V>;
  isScrolling(): boolean;
  startScrolling(): void;
  endScrolling(): void;
  /** Stop the render effect. */
  dispose(): void;
}

export function createVirtualizerState<T extends object, V, O = any>(opts: VirtualizerStateOptions<T, V, O>): VirtualizerState<T, V> {
  const sameRect = { equals: (a: Rect, b: Rect) => a.equals(b) };
  const visibleRect = signal(opts.initialVisibleRect ?? new Rect(0, 0, 0, 0), sameRect);
  const size = signal(opts.initialVisibleRect ? new Size(opts.initialVisibleRect.width, opts.initialVisibleRect.height) : new Size(), {
    equals: (a: Size, b: Size) => a.equals(b),
  });
  const isScrolling = signal(false);
  const invalidationContext = signal<InvalidationContext>({});
  const visibleViews = signal<ReusableView<T, V>[]>([], { equals: false });
  const contentSize = signal(new Size(), { equals: (a, b) => a.equals(b) });
  let visibleRectChanged = false;
  const virtualizer = new Virtualizer<T, V>({
    collection: untrack(() => read(opts.collection)),
    layout: untrack(() => read(opts.layout)),
    delegate: {
      setVisibleRect(rect) {
        visibleRect.set(rect);
        visibleRectChanged = true;
      },
      renderView: opts.renderView,
      invalidate: (ctx) => invalidationContext.set(ctx),
    },
  });

  // Merged invalidation context: a new object only when the context or the layout options change.
  let lastContext: InvalidationContext | null = null;
  let lastOptions: O | undefined;
  let merged: InvalidationContext = {};
  const { dispose } = createRoot((dispose) => {
    effect(() => {
      const layoutOptions = read(opts.layoutOptions);
      const context = invalidationContext();
      if (context !== lastContext || layoutOptions !== lastOptions) {
        lastContext = context;
        lastOptions = layoutOptions;
        merged = layoutOptions != null ? { ...context, layoutOptions } : context;
      }
      const rect = visibleRect();
      const views = virtualizer.render({
        layout: read(opts.layout),
        collection: read(opts.collection),
        persistedKeys: read(opts.persistedKeys) ?? null,
        layoutOptions,
        visibleRect: rect,
        size: opts.allowsWindowScrolling ? size() : rect,
        invalidationContext: merged,
        isScrolling: isScrolling(),
      });
      visibleViews.set(views);
      contentSize.set(virtualizer.contentSize);
      // onVisibleRectChange runs after the render (a layout effect in the original).
      if (visibleRectChanged) {
        visibleRectChanged = false;
        untrack(() => opts.onVisibleRectChange(visibleRect()));
      }
    });
    return dispose;
  });

  return {
    virtualizer,
    visibleViews,
    setVisibleRect: (rect) => visibleRect.set(rect),
    size,
    setSize: (value) => size.set(value),
    contentSize,
    isScrolling,
    startScrolling: () => isScrolling.set(true),
    endScrolling: () => isScrolling.set(false),
    dispose,
  };
}
