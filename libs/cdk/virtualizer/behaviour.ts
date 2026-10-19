// Virtualizer component behaviour: serializable model, server first window, and the browser driver that
// runs the engine (createVirtualizerState + createScrollView) once the visitor scrolls. Semantics follow
// react-aria/src/virtualizer/Virtualizer.tsx and react-aria-components/src/Virtualizer.tsx (React Spectrum,
// Apache-2.0, © Adobe): layout + layoutOptions, persisted keys, item measurement, load more.
// Resume: the model is plain signals + JSON + resumable functions; engine instances live only in the browser
// (one driver per scroller element, in a lazily created WeakMap).
import { computed, createRoot, effect, runWithOwner, untrack, type Signal } from "@rivetjs/reactivity";
import type { StyleObject } from "@rivetjs/runtime/style";
import { direction as directionOf } from "../bidi/index.ts";
import type { Key } from "../collections/index.ts";
import { createCollection, loaderNode, type Collection, type CollectionOptions, type Node } from "./collection.ts";
import { createScrollView, getScrollLeft, layoutInfoToStyle, measureItem, setScrollLeft, type ScrollView } from "./dom.ts";
import type { Layout } from "./layout.ts";
import type { LayoutInfo } from "./layout-info.ts";
import { Rect } from "./rect.ts";
import type { ReusableView } from "./reusable-view.ts";
import { Size } from "./size.ts";
import { createVirtualizerState, type VirtualizerState } from "./state.ts";
import type { Direction } from "./types.ts";
import { Virtualizer } from "./virtualizer-core.ts";

/** Key of the loader sentinel node the component appends when `isLoading` / `onLoadMore` are given. */
export const LOADER_KEY = "rv-virtualizer-loader";

/** One rendered view: JSON-serializable (server window) projection of a ReusableView + its LayoutInfo. */
export interface VirtualView<T = unknown> {
  /** Collection key (rows are keyed by it: kept keys keep their DOM). */
  key: Key;
  /** View type (`item`, `section`, `header`, `loader`, `row`, `cell`, …). */
  type: string;
  /** The data item (node value), or null (loaders, layout-generated views). */
  item: T | null;
  /** Index of the node within its parent. */
  index: number;
  level: number;
  parentKey: Key | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Size not measured yet (the browser measures it after rendering). */
  estimated: boolean;
  /** Position style relative to the parent view. */
  style: StyleObject;
  /** Child views (sections: header + items; tables: rows / cells). */
  children: VirtualView<T>[];
}

export type MaybeAccessor<T> = T | (() => T);
const read = <T>(value: MaybeAccessor<T>): T => (typeof value === "function" ? (value as () => T)() : value);

/** Serializable component state. */
export interface VirtualizerModel<T, O> {
  id: string;
  items: MaybeAccessor<readonly T[]>;
  /** Layout factory (`() => new ListLayout()`), called on the server and once in the browser. */
  layout: () => Layout<Node<T>, O>;
  layoutOptions?: O;
  collection: CollectionOptions<T>;
  initialSize: { width: number; height: number };
  dir?: Direction;
  isLoading?: MaybeAccessor<boolean>;
  onLoadMore?: () => void;
  loadMoreOffset: number;
  shouldObserveItemSize: boolean;
  /** Caller-persisted keys (plus the focused view). */
  persistedKeys: readonly Key[];
  focusedKey: Signal<Key | null>;
  views: Signal<VirtualView<T>[]>;
  contentSize: Signal<{ width: number; height: number }>;
  isScrolling: Signal<boolean>;
  onScroll?: (event: Event) => void;
}

function collectionOf<T, O>(model: VirtualizerModel<T, O>): Collection<Node<T>> {
  const loading = model.isLoading === undefined && !model.onLoadMore ? null : !!read(model.isLoading ?? false);
  return createCollection(read(model.items), model.collection, loading === null ? [] : [loaderNode<T>(LOADER_KEY, loading)]);
}

const persistedOf = <T, O>(model: VirtualizerModel<T, O>): Set<Key> => {
  const keys = new Set(model.persistedKeys);
  const focused = model.focusedKey();
  if (focused != null) keys.add(focused);
  return keys;
};

const sameStyle = (a: StyleObject, b: StyleObject): boolean => {
  const ka = Object.keys(a).filter((k) => a[k] != null),
    kb = Object.keys(b).filter((k) => b[k] != null);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
};

/** Views of the engine as JSON; unchanged views keep their previous object (resumed rows stay adopted). */
export function projectViews<T>(
  views: Iterable<ReusableView<Node<T>, unknown>>,
  dir: Direction | undefined,
  previous: Map<Key, VirtualView<T>>,
  parent: LayoutInfo | null = null,
): VirtualView<T>[] {
  const out: VirtualView<T>[] = [];
  for (const view of views) {
    const li = view.layoutInfo;
    if (!li) continue;
    const node = view.content;
    const children = projectViews(view.children, dir, previous, li);
    const next: VirtualView<T> = {
      key: li.key,
      type: li.type,
      item: (node?.value ?? null) as T | null,
      index: node?.index ?? 0,
      level: node?.level ?? 0,
      parentKey: li.parentKey,
      x: li.rect.x,
      y: li.rect.y,
      width: li.rect.width,
      height: li.rect.height,
      estimated: li.estimatedSize,
      style: layoutInfoToStyle(li, dir, parent),
      children,
    };
    const old = previous.get(li.key);
    const same =
      old &&
      old.type === next.type &&
      old.item === next.item &&
      old.index === next.index &&
      old.level === next.level &&
      old.parentKey === next.parentKey &&
      old.x === next.x &&
      old.y === next.y &&
      old.width === next.width &&
      old.height === next.height &&
      old.estimated === next.estimated &&
      sameStyle(old.style, next.style) &&
      old.children.length === children.length &&
      old.children.every((c, i) => c === children[i]);
    out.push(same ? old : next);
  }
  return out;
}

const flatten = <T>(views: readonly VirtualView<T>[], into = new Map<Key, VirtualView<T>>()): Map<Key, VirtualView<T>> => {
  for (const view of views) {
    into.set(view.key, view);
    flatten(view.children, into);
  }
  return into;
};

const sizeOfContent = (size: Size) => ({ width: size.width, height: size.height });

/** First window for the server render (and client-rendered mounts): the engine at `initialSize`, scrolled to 0. */
export function initialWindow<T, O>(model: VirtualizerModel<T, O>): { views: VirtualView<T>[]; contentSize: { width: number; height: number } } {
  return untrack(() => {
    const collection = collectionOf(model);
    const layout = model.layout();
    const virtualizer = new Virtualizer<Node<T>, unknown>({
      collection,
      layout,
      delegate: { setVisibleRect() {}, renderView: (_type, content) => content, invalidate() {} },
    });
    const { width, height } = model.initialSize;
    const views = virtualizer.render({
      layout,
      collection,
      persistedKeys: new Set(model.persistedKeys),
      visibleRect: new Rect(0, 0, width, height),
      size: new Size(width, height),
      invalidationContext: model.layoutOptions != null ? { layoutOptions: model.layoutOptions } : {},
      isScrolling: false,
      layoutOptions: model.layoutOptions,
    });
    return { views: projectViews(views, model.dir, new Map()), contentSize: sizeOfContent(virtualizer.contentSize) };
  });
}

interface Driver {
  state: VirtualizerState<Node<unknown>, unknown>;
  scrollView: ScrollView;
  loadingMore: boolean;
  lastItems: unknown;
}

let drivers: WeakMap<Element, Driver> | undefined;

const viewElement = (root: Element, key: Key): HTMLElement | null => {
  for (const el of root.querySelectorAll<HTMLElement>("[data-rv-view]")) if (el.dataset.rvView === String(key)) return el;
  return null;
};

/** The browser driver of `model` (created on first use: engine, scroll view, measurement). */
export function driverOf<T, O>(model: VirtualizerModel<T, O>, element?: Element | null): Driver | null {
  const el = (element ?? (typeof document === "undefined" ? null : document.getElementById(model.id))) as HTMLElement | null;
  if (!el) return null;
  drivers ??= new WeakMap();
  const existing = drivers.get(el);
  if (existing) return existing;
  // Detached from the caller's owner: `createRoot` attaches to the current owner, and the first caller may be the
  // rows' `For` binding (`visibleViews` on a resumed page's first projection), which disposes its children on its
  // next run — the cached driver then kept dead effects and an items change no longer reached the engine
  // (cdk-docs `virtualizer-items`, cold scroll then filter, 2026-10-19). The driver lives with its element.
  return runWithOwner(null, () => createDriver(model, el));
}

function createDriver<T, O>(model: VirtualizerModel<T, O>, el: HTMLElement): Driver {
  const dir = (): Direction => model.dir ?? directionOf(el);
  const collection = computed(() => collectionOf(model) as Collection<Node<unknown>>);
  const layout = untrack(() => model.layout()) as unknown as Layout<Node<unknown>>;
  let state: VirtualizerState<Node<unknown>, unknown> | undefined;
  const scrollView = createScrollView(el, {
    contentSize: () => untrack(() => state?.contentSize() ?? new Size(model.contentSize().width, model.contentSize().height)),
    onVisibleRectChange: (rect) => state?.setVisibleRect(rect),
    onScrollStart: () => {
      state?.startScrolling();
      model.isScrolling.set(true);
    },
    onScrollEnd: () => {
      state?.endScrolling();
      model.isScrolling.set(false);
    },
    direction: dir,
  });
  state = createVirtualizerState<Node<unknown>, unknown>({
    layout,
    collection,
    renderView: (_type, content) => content,
    onVisibleRectChange(rect) {
      setScrollLeft(el, dir(), rect.x);
      el.scrollTop = rect.y;
    },
    persistedKeys: () => persistedOf(model),
    layoutOptions: model.layoutOptions,
    initialVisibleRect: new Rect(getScrollLeft(el, dir()), el.scrollTop, el.clientWidth, el.clientHeight),
  });
  const driver: Driver = { state, scrollView, loadingMore: false, lastItems: undefined };
  drivers!.set(el, driver);
  scrollView.updateSize();

  // Project engine views into the model (the rows' For), then measure estimated views once rendered.
  let observer: ResizeObserver | null = null;
  const observed = new WeakSet<Element>();
  const measureQueue = new Set<Key>();
  let scheduled = false;
  const measure = () => {
    scheduled = false;
    for (const key of measureQueue) {
      const element = viewElement(el, key);
      if (element) measureItem(state!.virtualizer, key, element);
    }
    measureQueue.clear();
  };
  const schedule = (key: Key) => {
    measureQueue.add(key);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(measure);
    }
  };
  if (model.shouldObserveItemSize && typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const key = (entry.target.parentElement as HTMLElement | null)?.closest<HTMLElement>("[data-rv-view]")?.dataset.rvView;
        const view = key == null ? undefined : [...flatten(untrack(model.views)).values()].find((v) => String(v.key) === key);
        if (view) schedule(view.key);
      }
    });
  }
  computedEffect(() => {
    const views = state!.visibleViews();
    const contentSize = state!.contentSize();
    untrack(() => {
      const previous = flatten(model.views());
      // Rows leaving the window read their last descriptor (viewOf); on a resumed page no row accessor ran
      // before this first projection, so the replaced (server) views seed that cache.
      remember(model, previous);
      const next = projectViews(views as Iterable<ReusableView<Node<T>, unknown>>, model.dir, previous);
      model.views.set(next);
      const size = model.contentSize();
      if (size.width !== contentSize.width || size.height !== contentSize.height) model.contentSize.set(sizeOfContent(contentSize));
      const visit = (list: VirtualView<T>[]) => {
        for (const view of list) {
          if (view.estimated) schedule(view.key);
          visit(view.children);
        }
      };
      visit(next);
      if (observer)
        queueMicrotask(() => {
          for (const element of el.querySelectorAll<HTMLElement>("[data-rv-view]"))
            for (const child of element.children) if (!observed.has(child)) (observed.add(child), observer!.observe(child));
        });
    });
  });
  return driver;
}

// The driver's projection effect: its own root (created under the detached driver, so it outlives region re-creation).
function computedEffect(fn: () => void): void {
  createRoot(() => effect(fn));
}

/** Rows of the model: the server window, or (browser) the driver's projection; reads `items` for reactivity. */
export function visibleViews<T, O>(model: VirtualizerModel<T, O>): VirtualView<T>[] {
  if (typeof model.items === "function") (model.items as () => readonly T[])();
  if (typeof model.isLoading === "function") model.isLoading();
  if (typeof document !== "undefined") untrack(() => driverOf(model));
  return model.views();
}

/** Keys of `views`: the rows' `For` items. Keys keep their identity across windows, so resumed server rows are
 * adopted and kept (a `For` re-creates an adopted row whose item changed; view descriptors change on every move). */
export const viewKeys = <T>(views: readonly VirtualView<T>[]): Key[] => views.map((view) => view.key);

let indexes: WeakMap<readonly VirtualView<unknown>[], Map<Key, VirtualView<unknown>>> | undefined;
let last: WeakMap<object, Map<Key, VirtualView<unknown>>> | undefined;
const seenOf = (model: object): Map<Key, VirtualView<unknown>> => {
  let seen = (last ??= new WeakMap()).get(model);
  if (!seen) last.set(model, (seen = new Map()));
  return seen;
};
// The views a projection replaces: rows removed by it still find their descriptor.
function remember<T, O>(model: VirtualizerModel<T, O>, views: Map<Key, VirtualView<T>>): void {
  const seen = seenOf(model);
  for (const [key, view] of views) seen.set(key, view);
}
/** The view with `key` in `views` (a row's descriptor); a row being removed keeps its last descriptor. */
export function viewOf<T, O>(model: VirtualizerModel<T, O>, views: readonly VirtualView<T>[], key: Key): VirtualView<T> {
  let index = (indexes ??= new WeakMap()).get(views);
  if (!index) indexes.set(views, (index = new Map(views.map((view) => [view.key, view]))));
  const seen = seenOf(model);
  const view = index.get(key);
  if (!view) return seen.get(key) as VirtualView<T>;
  seen.set(key, view);
  return view as VirtualView<T>;
}

/** Scroll handler of the scroller: drive the engine, load more near the end, then the caller's `onScroll`. */
export function virtualizerScroll<T, O>(model: VirtualizerModel<T, O>, event: Event): void {
  const el = event.currentTarget as HTMLElement;
  const driver = driverOf(model, el);
  if (!driver) return;
  driver.scrollView.onScroll(event);
  loadMore(model, driver, el);
  model.onScroll?.(event);
}

function loadMore<T, O>(model: VirtualizerModel<T, O>, driver: Driver, el: HTMLElement): void {
  if (!model.onLoadMore) return;
  const items = untrack(() => read(model.items));
  const loading = untrack(() => !!read(model.isLoading ?? false));
  // A finished load (new items or loading flag reset) re-arms the trigger.
  if (items !== driver.lastItems || loading) driver.loadingMore = loading;
  driver.lastItems = items;
  if (driver.loadingMore) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < el.clientHeight * model.loadMoreOffset) {
    driver.loadingMore = true;
    model.onLoadMore();
  }
}

/** focusin: the focused view stays rendered (persisted) while scrolled out of view. */
export function virtualizerFocusIn<T, O>(model: VirtualizerModel<T, O>, event: FocusEvent): void {
  const key = (event.target as Element | null)?.closest?.<HTMLElement>("[data-rv-view]")?.dataset.rvView;
  if (key == null) return;
  const view = [...flatten(untrack(model.views)).values()].find((v) => String(v.key) === key);
  if (view && untrack(model.focusedKey) !== view.key) model.focusedKey.set(view.key);
  driverOf(model, event.currentTarget as Element);
}

/** Style of the content element (size of the scrollable content; no pointer events while scrolling). */
export function contentStyle<T, O>(model: VirtualizerModel<T, O>): StyleObject {
  const { width, height } = model.contentSize();
  return {
    position: "relative",
    width: Number.isFinite(width) && width > 0 ? width + "px" : undefined,
    height: Number.isFinite(height) ? height + "px" : undefined,
    "pointer-events": model.isScrolling() ? "none" : undefined,
  };
}

/** Style of the scroller: overflow per scroll direction, padding reset (padding is done by the layout). */
export function scrollerStyle(scrollDirection: "horizontal" | "vertical" | "both"): StyleObject {
  return scrollDirection === "horizontal"
    ? { padding: "0", "overflow-x": "auto", "overflow-y": "hidden" }
    : scrollDirection === "vertical"
      ? { padding: "0", "overflow-y": "auto", "overflow-x": "hidden" }
      : { padding: "0", overflow: "auto" };
}
