// Virtualizer component: the react-aria / react-aria-components `Virtualizer` (React Spectrum, Apache-2.0,
// © Adobe) for Rivet. The server renders the first window (engine at `initialSize`, absolutely positioned
// views); the browser runs the engine from the first scroll (or focus) on: measured sizes, keyed rows.
// Resumed pages: no library code runs before the visitor scrolls (`preload="interaction"` on the scroller).
import { computed, signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { Slot } from "@rivetjs/runtime/jsx-runtime";
import type { Key } from "../collections/index.ts";
import { createId } from "../utils/id.ts";
import {
  contentStyle,
  initialWindow,
  scrollerStyle,
  virtualizerFocusIn,
  virtualizerScroll,
  viewKeys,
  viewOf,
  visibleViews,
  type LayoutInput,
  type MaybeAccessor,
  type VirtualizerModel,
  type VirtualView,
} from "./behaviour.ts";
import type { CollectionOptions, Node } from "./collection.ts";
import type { Direction } from "./types.ts";
import type { StyleObject } from "@rivetjs/runtime/style";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";

/** Global DOM props the scroller sets itself (`onScroll` runs after the virtualizer's, `dir` positions views). */
const OWNED = ["onScroll", "dir"] as const;

/** Global DOM events / attributes go to the scroller element. */
export interface VirtualizerProps<T, O> extends Omit<GlobalDOMAttributes<HTMLDivElement>, "dir" | "onScroll"> {
  /** The data: an array, or an accessor (`() => list()`) whose changes re-render the window. */
  items: MaybeAccessor<readonly T[]>;
  /** Layout class (`ListLayout`) or factory (`() => new ListLayout()`): resumable, instantiated on the server and on first scroll. */
  layout: LayoutInput<O>;
  /** Options for the layout (JSON: `{ rowHeight: 32 }`, `{ minItemSize: { width: 120, height: 120 } }`). */
  layoutOptions?: O;
  /** View content: `(item, view) => …`; `view().type` tells items from sections / headers / loaders. */
  children: Slot<[item: () => T, view: () => VirtualView<T>]>;
  /** Viewport size used for the server-rendered window (match the scroller's CSS size). Default 800 x 600. */
  initialSize?: { width: number; height: number };
  /** Scrollable axes. Default `vertical` (`both` for grids wider than the viewport). */
  scrollDirection?: "horizontal" | "vertical" | "both";
  /** Keys always rendered even when out of view (the focused view is persisted automatically). */
  persistedKeys?: Iterable<Key>;
  /** Whether more data is loading (reserves the loader view's size). */
  isLoading?: MaybeAccessor<boolean>;
  /** Called when scrolled within `loadMoreOffset` viewports of the end. */
  onLoadMore?: () => void;
  /** Distance from the end that triggers `onLoadMore`, in viewport heights. Default 1. */
  loadMoreOffset?: number;
  /** Re-measure views when their content resizes (ResizeObserver on each view's children). */
  shouldObserveItemSize?: boolean;
  /** Text direction for view positions (`left` / `right`); default: logical `inset-inline-start`. */
  dir?: Direction;
  /** Collection adapter options: keys, node types, section children. */
  getKey?: CollectionOptions<T>["getKey"];
  getType?: CollectionOptions<T>["getType"];
  getChildren?: CollectionOptions<T>["getChildren"];
  getTextValue?: CollectionOptions<T>["getTextValue"];
  /** Caller scroll handler (runs after the virtualizer's). */
  onScroll?: (event: Event) => void;
  id?: string;
  /** Scroller role (e.g. `listbox`, `grid`); default `presentation`-free plain div. */
  role?: string;
  label?: string;
  labelledBy?: string;
  tabIndex?: number;
  /** Scroller class (default `rv-Virtualizer`). */
  class?: string;
  /** Scroller inline style (sizing), merged over the overflow style. */
  style?: StyleObject;
  /** View wrapper class (default `rv-Virtualizer-item`). */
  itemClass?: string;
}

/**
 * Renders a scrollable collection with a layout (ListLayout, GridLayout, TableLayout, WaterfallLayout): only
 * views inside the visible rect (plus overscan and persisted keys) are in the DOM. Renders its own views
 * (`children(item, view)`) from `items`; a cdk collection component (`ListBox`, `Table`) is virtualized by
 * `CollectionVirtualizer` (`./collection-renderer.tsx`), kept apart so this component and its users (Masonry)
 * carry none of the collection renderer.
 */
export function Virtualizer<T, O = unknown>(props: VirtualizerProps<T, O>) {
  const collection: CollectionOptions<T> = {};
  if (props.getKey) collection.getKey = props.getKey;
  if (props.getType) collection.getType = props.getType;
  if (props.getChildren) collection.getChildren = props.getChildren;
  if (props.getTextValue) collection.getTextValue = props.getTextValue;
  const model: VirtualizerModel<T, O> = {
    id: props.id ?? createId(),
    items: props.items,
    layout: props.layout,
    layoutOptions: props.layoutOptions,
    collection,
    initialSize: props.initialSize ?? { width: 800, height: 600 },
    dir: props.dir,
    isLoading: props.isLoading,
    onLoadMore: props.onLoadMore,
    loadMoreOffset: props.loadMoreOffset ?? 1,
    shouldObserveItemSize: props.shouldObserveItemSize ?? false,
    persistedKeys: [...(props.persistedKeys ?? [])],
    focusedKey: signal<Key | null>(null),
    views: signal<VirtualView<T>[]>([]),
    contentSize: signal({ width: 0, height: 0 }),
    isScrolling: signal(false),
    onScroll: props.onScroll,
  };
  const first = initialWindow(model);
  model.views.set(first.views);
  model.contentSize.set(first.contentSize);
  const render = props.children;
  const itemClass = props.itemClass ?? "rv-Virtualizer-item";
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = globalDOMProps(props, OWNED);
  const className = props.class ?? "rv-Virtualizer",
    role = props.role,
    label = props.label,
    labelledBy = props.labelledBy,
    tabIndex = props.tabIndex,
    dir = props.dir,
    style = { ...scrollerStyle(props.scrollDirection ?? "vertical"), ...props.style };
  return (
    <div
      {...dom}
      id={model.id}
      class={className}
      role={role}
      aria-label={label}
      aria-labelledby={labelledBy}
      tabIndex={tabIndex}
      dir={dir}
      style={style}
      preload="interaction"
      onScroll={(event) => virtualizerScroll(model, event)}
      onFocusIn={(event) => virtualizerFocusIn(model, event)}
    >
      <div role="presentation" class="rv-Virtualizer-content" style={contentStyle(model)}>
        <For each={() => viewKeys(visibleViews(model))} by={(key) => key}>
          {(key) => {
            // Local functions, not call arguments: the row accessors handed to `children` must be resumable (R2).
            const view = () => viewOf(model, model.views(), key());
            const item = () => view().item as T;
            // A computed: the branch re-runs only when a view gains / loses children, not on every layout pass
            // (a resumed page would re-create the nested rows and leave their server bindings on removed elements).
            const nested = computed(() => view().children.length > 0);
            return (
              <div role="presentation" class={itemClass} data-rv-view={String(key())} data-rv-type={view().type} style={view().style}>
                {render(item, view)}
                {nested() ? <VirtualizerChildren model={model} views={() => view().children} render={render} itemClass={itemClass} /> : null}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

/** Nested views (section items, table rows / cells), positioned relative to their parent view. */
function VirtualizerChildren<T, O>(props: {
  model: VirtualizerModel<T, O>;
  views: () => VirtualView<T>[];
  render: Slot<[item: () => T, view: () => VirtualView<T>]>;
  itemClass: string;
}) {
  const { model, views, render, itemClass } = props;
  return (
    <For each={() => viewKeys(views())} by={(key) => key}>
      {(key) => {
        // Local functions, not call arguments: the row accessors handed to `children` must be resumable (R2).
        const view = () => viewOf(model, views(), key());
        const item = () => view().item as T;
        const nested = computed(() => view().children.length > 0);
        return (
          <div role="presentation" class={itemClass} data-rv-view={String(key())} data-rv-type={view().type} style={view().style}>
            {render(item, view)}
            {nested() ? <VirtualizerChildren model={model} views={() => view().children} render={render} itemClass={itemClass} /> : null}
          </div>
        );
      }}
    </For>
  );
}
