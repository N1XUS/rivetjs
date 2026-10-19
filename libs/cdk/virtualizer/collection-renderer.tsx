// `<CollectionVirtualizer>`: the react-aria-components `Virtualizer` (src/Virtualizer.tsx: the
// `CollectionRenderer` with `CollectionRoot` / `CollectionBranch` over useVirtualizerState + useScrollView, and
// VirtualizerItem / useVirtualizerItem; React Spectrum, Apache-2.0, © Adobe) for the cdk collection components:
// `<CollectionVirtualizer layout={ListLayout}><ListBox …/></CollectionVirtualizer>`, `<CollectionVirtualizer layout={TableLayout}><Table …/></CollectionVirtualizer>`.
// Hosts: ListBox (+ sections), GridList (ListLayout / GridLayout), Menu, Tree (flattened rows), Table.
// A separate component from the standalone `<Virtualizer items>` (`./virtualizer.tsx`) so items users (Masonry) ship none of this.
// Rivet:
// - The host (ListBox, GridList, Menu, Tree, Table) builds its collection and passes an accessor of it to `CollectionRoot` with its
//   scroll container (`scrollRef`, the host element) and its focused key (`focusedKey`, persisted); the engine
//   is the standalone component's driver (`./behaviour.ts`): the server renders the first window at `initialSize`,
//   the browser starts the engine on the first scroll (the host forwards its `scroll` events to `onScroll`), focus
//   move (a persisted key) or layout delegate call (keyboard Page Up / Down).
// - Every view renders in a wrapper `div[role=presentation]` (VirtualizerItem: `data-rv-view`, `data-rv-type`,
//   absolute / sticky position from the layout); the node's part renders inside it (`node.render(node)`) with this
//   renderer provided, so a part rendering its children (`CollectionBranch`: sections, table rows / cells) gets
//   the child views of its own view.
// - Resume: the renderer object's functions capture only `link` (layout factory, options, the root's model);
//   the model holds signals, the host's collection accessor, its focused key signal and its scroll ref.
// Deviations: no drop indicators (DnD); no window scrolling; rows are keyed by collection key (no DOM recycling
// across items, as the standalone component); a layout instance is not accepted (a class or a factory: the
// instance would be serialized).
import { computed, signal, untrack } from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import {
  CollectionRendererContext,
  DefaultCollectionRenderer,
  sameRender,
  type CollectionBranchProps,
  type CollectionRenderer,
  type CollectionRootProps,
} from "../collections/components.tsx";
import type { Collection as ICollection, Key, Node as CollectionNode } from "../collections/types.ts";
import {
  childViews,
  contentStyle,
  driverOf,
  initialWindow,
  ROOT_VIEW,
  rowOrder,
  viewOf,
  visibleViews,
  type LayoutInput,
  type VirtualView,
  type VirtualizerModel,
} from "./behaviour.ts";
import type { Node } from "./collection.ts";
import { Rect } from "./rect.ts";
import { Size } from "./size.ts";
import type { Direction } from "./types.ts";

/** What the renderer's functions capture (plain data + the root's model, set when the host renders its root). */
export interface VirtualizerLink<O = unknown> {
  layout: LayoutInput<O>;
  layoutOptions: O | undefined;
  initialSize: { width: number; height: number };
  dir: Direction | undefined;
  /** The model of the host's `CollectionRoot` (one collection per Virtualizer). */
  model: VirtualizerModel<unknown, O> | null;
}

const engineOf = (link: VirtualizerLink<any>) => (link.model ? (driverOf(link.model)?.state.virtualizer ?? null) : null);

let renderers: WeakMap<object, CollectionRenderer> | undefined;

/**
 * The virtualized `CollectionRenderer` of `link` (one per link). Not read from `CollectionRendererContext` below the
 * host: a resumed page re-creates a part's branch (a binding re-run) without the server's providers, where the
 * context is the default renderer; the renderer object resumes from `link` instead.
 */
export function rendererOf(link: VirtualizerLink<any>): CollectionRenderer {
  let renderer = (renderers ??= new WeakMap()).get(link);
  if (!renderer) renderers.set(link, (renderer = VirtualizerRenderer(link)));
  return renderer;
}

/** A PascalCase factory: its object-literal arrows are resumable closures over `link` only. */
function VirtualizerRenderer(link: VirtualizerLink<any>): CollectionRenderer {
  return {
    isVirtualized: true,
    // RAC: the layout is the collection's layout delegate (keyboard Page Up / Down, range selection).
    layoutDelegate: {
      getItemRect: (key) => layoutRect(link, key),
      getVisibleRect: () => layoutVisibleRect(link),
      getContentSize: () => layoutContentSize(link),
    },
    CollectionRoot: (root) => <VirtualizerRoot link={link} root={root} />,
    CollectionBranch: (branch) => <VirtualizerBranch link={link} branch={branch} />,
    onScroll: (event) => virtualizerLinkScroll(link, event),
  };
}

/** The scroll handler hosts forward their scroll container's `scroll` events to (the engine starts on the first). */
export function virtualizerLinkScroll(link: VirtualizerLink<any>, event: Event): void {
  const model = link.model;
  if (!model) return;
  const driver = driverOf(model, event.currentTarget as Element);
  driver?.scrollView.onScroll(event);
}

/** RAC: the layout is the collection's layout delegate (keyboard Page Up / Down, range selection). */
export function layoutRect(link: VirtualizerLink<any>, key: Key): Rect | null {
  return engineOf(link)?.layout.getLayoutInfo(key)?.rect ?? null;
}
export function layoutVisibleRect(link: VirtualizerLink<any>): Rect {
  return engineOf(link)?.visibleRect ?? new Rect();
}
export function layoutContentSize(link: VirtualizerLink<any>): Size {
  return engineOf(link)?.layout.getContentSize() ?? new Size();
}

const isServer = typeof document === "undefined";

/**
 * The node at `key` of the host's collection. As `renderNodeAt`: server once, untracked; browser a region that keeps
 * the part while the node renders the same (`sameRender`).
 */
function renderNode(model: VirtualizerModel<unknown, unknown>, key: Key): unknown {
  const at = (): CollectionNode<unknown> | null => (model.source?.() as ICollection<CollectionNode<unknown>> | null)?.getItem(key) ?? null;
  if (isServer)
    return untrack(() => {
      const n = at();
      return n?.render ? n.render(n) : null;
    });
  const node = computed(at, { equals: sameRender });
  return () => {
    node();
    const n = untrack(at);
    return n?.render ? untrack(() => n.render!(n)) : null;
  };
}

/**
 * VirtualizerItem: one view's wrapper (position + size of its layout info) and its node's part, rendered with this
 * renderer provided (a `Provider` binding: a part's lazily evaluated content still sees it) — a part rendering its
 * children (`CollectionBranch`: sections, table rows / cells) gets the child views of its own view.
 */
function VirtualizerView(props: {
  model: VirtualizerModel<unknown, unknown>;
  renderer: CollectionRenderer;
  viewKey: Key;
  views: () => VirtualView<unknown>[];
}) {
  const { model, renderer, viewKey, views } = props;
  const view = () => viewOf(model, views(), viewKey);
  return (
    <div role="presentation" class="rv-Virtualizer-item" data-rv-view={String(viewKey)} data-rv-type={view().type} style={view().style}>
      <Provider token={CollectionRendererContext} value={renderer}>
        {renderNode(model, viewKey) as never}
      </Provider>
    </div>
  );
}

/** `CollectionRoot` of the virtualizer renderer: the sized content element and the root views. */
export function VirtualizerRoot(props: { link: VirtualizerLink<any>; root: CollectionRootProps }) {
  const { link, root } = props;
  const renderer = rendererOf(link);
  const collection = root.collection;
  const scrollRef = root.scrollRef as (() => Element | null | undefined) | undefined;
  const model: VirtualizerModel<unknown, unknown> = {
    id: "",
    items: [],
    source: typeof collection === "function" ? (collection as () => ICollection<Node<unknown>>) : undefined,
    focus: root.focusedKey,
    scrollRef: typeof scrollRef === "function" ? scrollRef : undefined,
    // The class / factory itself (a module reference or a resumable function), never a closure over `link`.
    layout: link.layout as never,
    layoutOptions: link.layoutOptions,
    collection: {},
    initialSize: link.initialSize,
    dir: link.dir,
    loadMoreOffset: 1,
    shouldObserveItemSize: false,
    persistedKeys: [],
    focusedKey: signal<Key | null>(null),
    views: signal<VirtualView<unknown>[]>([]),
    contentSize: signal({ width: 0, height: 0 }),
    isScrolling: signal(false),
  };
  if (!model.source) throw new Error("Virtualizer: the collection component must pass its built collection (an accessor) to CollectionRoot.");
  link.model = model;
  // Untracked: the body must not depend on the collection / focused key (a resumed page would re-create the
  // root, its content element and the focused option on the first focus move).
  const first = untrack(() => initialWindow(model));
  model.views.set(first.views);
  model.contentSize.set(first.contentSize);
  const rootViews = () => visibleViews(model);
  return (
    <div role="presentation" class="rv-Virtualizer-content" style={contentStyle(model)}>
      <For each={() => rowOrder(model, ROOT_VIEW, rootViews())} by={(key: Key) => key}>
        {(key: () => Key) => <VirtualizerView model={model} renderer={renderer} viewKey={untrack(key)} views={rootViews} />}
      </For>
    </div>
  );
}

/** `CollectionBranch` of the virtualizer renderer: the rendered child views of `parentKey`'s view. */
export function VirtualizerBranch(props: { link: VirtualizerLink<any>; branch: CollectionBranchProps }) {
  const link = props.link;
  const model = link.model;
  const renderer = rendererOf(link);
  // A part rendered outside the window (no root yet): render its children as the default renderer would.
  if (!model) return DefaultCollectionRenderer.CollectionBranch(props.branch);
  const parentKey = props.branch.parent.key;
  const views = () => childViews(model, parentKey);
  return (
    <For each={() => rowOrder(model, parentKey, views())} by={(key: Key) => key}>
      {(key: () => Key) => <VirtualizerView model={model} renderer={renderer} viewKey={untrack(key)} views={views} />}
    </For>
  );
}

/**
 * RAC `Virtualizer` for a collection component: wraps one `ListBox` / `GridList` / `Menu` / `Tree` / `Table` and renders its collection with
 * `layout` — only the views in the visible rect (plus overscan and the focused item) are in the DOM. The component's
 * own element is the scroll container (give it a height and `overflow: auto`).
 */
export interface CollectionVirtualizerProps<O> {
  /** The collection component (`<ListBox>`, `<GridList>`, `<Menu>`, `<Tree>`, `<Table>`). */
  children: unknown;
  /** Layout class (`ListLayout`, `TableLayout`, `GridLayout`, `WaterfallLayout`) or factory (`() => new ListLayout()`). */
  layout: LayoutInput<O>;
  /** Options for the layout (JSON: `{ rowHeight: 48 }`). */
  layoutOptions?: O;
  /** Rivet: viewport size of the server-rendered window (match the scroll container's CSS size). Default 800 x 600. */
  initialSize?: { width: number; height: number };
  /** Rivet: text direction of view positions (`left` / `right`); default: logical `inset-inline-start`. */
  dir?: Direction;
}

/** Provides the virtualized `CollectionRenderer` (layout = layout delegate) to its child collection. */
export function CollectionVirtualizer<O = unknown>(props: CollectionVirtualizerProps<O>) {
  const link: VirtualizerLink<O> = {
    layout: props.layout,
    layoutOptions: props.layoutOptions,
    initialSize: props.initialSize ?? { width: 800, height: 600 },
    dir: props.dir,
    model: null,
  };
  const renderer = rendererOf(link);
  return (
    <Provider token={CollectionRendererContext} value={renderer}>
      {props.children as never}
    </Provider>
  );
}
