// Ported from react-aria (src/collections/CollectionBuilder.tsx, src/collections/Hidden.tsx,
// src/collections/useCachedChildren.ts) and react-aria-components (src/Collection.tsx), Apache-2.0,
// © Adobe.
//
// The RAC collection API over Rivet: `createLeafComponent` / `createBranchComponent` define collection
// parts (ListBoxItem, ListBoxSection, MenuItem, TreeItem, Row, …), `Collection` renders static or
// `items`-driven children, `CollectionBuilder` builds a `BaseCollection` from JSX.
//
// Rivet: two render modes instead of React's hidden portal render + real render.
// - Live (default): parts render their real DOM in place, inside the host's DOM (`data-key` on the
//   item element); the host's state reads the collection back from the DOM at event time
//   (`./dom.ts` `domCollection`). Server HTML = final markup, resumed pages need no item model, and a
//   host that never needs a built collection pays nothing (ListBox).
// - Build (`buildCollection` / `CollectionBuilder` / `collectionOf`): the content runs once in build
//   mode — parts register `CollectionNodeSpec`s (with a `render` thunk) and render nothing — and the
//   specs commit into a frozen `BaseCollection`. Used where upstream needs the collection before /
//   without the item DOM: closed Select / ComboBox popovers (selected item text, filtered size),
//   flattened trees (Tree / Table: `CollectionRoot` renders `node.render(node)` per node), virtualizers.
//   Inside a `computed`, so a signal read by the content (items, filters) rebuilds it — also inside the
//   (untracked) component bodies of nested parts, which re-enter the build's observer (`tracked`); a resumed
//   handler capturing the computed rebuilds it in the browser from its recipe. Built rows render through
//   `renderNodeAt`: a rebuilt node that renders the same keeps its DOM (`sameRender`).
// Deviation: `CollectionBuilder` children get an accessor `() => C` (reactive), not a value.
// Deviation: in live mode a part's `node` has key / type / value / textValue / props / level /
//   parentKey; index / prevKey / nextKey / firstChildKey are unset (no siblings known) — read them from
//   a built collection. Never capture `node` (class instance) in a resumable handler: capture `node.key`.
// Deviation: branch nodes carry `content` (Rivet field): the branch's lazy children; the default
//   `CollectionBranch` renders it in live mode.
// Deviation: `dependencies` is accepted and ignored (signals re-render; no item cache to invalidate).
// Deviation: React hook names → Rivet (`useIsHidden` → `isHidden`, `usePersistedKeys` →
//   `persistedKeys`, `useCachedChildren` → `collectionChildren`).
import {
  _observer,
  _regionState,
  _reobserve,
  _scoped,
  _tracker,
  computed,
  createContext,
  provide,
  runWithOwner,
  untrack,
  useContext,
  type Context,
  type Owner,
} from "@rivetjs/reactivity";
import { For, Provider } from "@rivetjs/runtime/dom";
import type { RefProp } from "@rivetjs/runtime/jsx-runtime";
import { _rUnrecorded, resumableContext } from "@rivetjs/runtime/resume-format";
import { isSlot } from "@rivetjs/runtime/slot";
import { HiddenContext } from "./hidden.ts";
import { domRowItem } from "#server";
import { rowKey, stampSet, stamp, type RowBox } from "./row-stamps.ts";
import { hasLive } from "../utils/live.tsx";
import { mergeProps as mergeLive, splitProps } from "@rivetjs/runtime/props";
import {
  BaseCollection,
  buildCollection,
  collectionNodeClass,
  type CollectionNode,
  type CollectionNodeClass,
  type CollectionNodeSpec,
  type Mutable,
} from "./base.ts";
import type { Collection as ICollection, Key, LayoutDelegate, Node, SelectionBehavior, SelectionMode } from "./types.ts";

export type { CollectionNodeClass, CollectionNodeSpec } from "./base.ts";

// ---------------------------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------------------------

/** Build scope (internal, synchronous; never resumed): where parts register their node specs. */
interface BuildScope {
  readonly specs: CollectionNodeSpec<any>[];
  readonly parentKey: Key | null;
  /** Ordinal of the next id-less part under this parent (`generatedId`). */
  readonly ids: { n: number };
  /** The build's observer (shared by the nested scopes of one build; cleared when the build ends). */
  readonly run: BuildRun;
  /** `probeCollection` (an id probe): collection roots merge their own id and register nothing. */
  readonly probe?: true;
}
interface BuildRun {
  o: object | null;
}
const BuildContext = createContext<BuildScope | null>(null);

/** Live scope: parent / level / id scope of the parts rendered below (plain data, resumable). */
export interface CollectionScope {
  readonly parentKey: Key | null;
  readonly level: number;
  readonly idScope?: Key | undefined;
  /** Ordinal of the next id-less part under this parent (`generatedId`). */
  readonly ids: { n: number };
}
/** Provided by collection hosts (`CollectionRoot`) and branches; `null` outside any collection. */
export const CollectionScopeContext = resumableContext(createContext<CollectionScope | null>(null, { id: "rv-collection-scope" }));

/** Defaults a `Collection items` row gives its part (`useCachedChildren` `addIdAndValue`). */
interface ItemDefaults {
  readonly id: Key | undefined;
  readonly value: unknown;
}
const CollectionItemContext = resumableContext(createContext<ItemDefaults | null>(null, { id: "rv-collection-item" }));
/**
 * RAC `addIdAndValue` clones the ONE element a row renders: only the first part of a row takes the
 * row's id / value (a fragment's other parts, e.g. a trailing load-more item, keep their own / auto
 * ids). Tracked outside the (serialized) context value so a re-created region starts fresh.
 */
const consumedDefaults = new WeakSet<ItemDefaults>();
function takeItemDefaults(): ItemDefaults | null {
  const defaults = useContext(CollectionItemContext);
  if (!defaults || consumedDefaults.has(defaults)) return null;
  consumedDefaults.add(defaults);
  return defaults;
}

/**
 * Rivet: the `id` an `items` row assigns to a part that is not a collection node (RAC useCachedChildren clones
 * the rendered element with `id`: TabPanel inside `<TabPanels items>`), or `undefined` outside a row / when a part
 * of the row already took it. Call once, at the start of the part's body.
 */
export function collectionItemId(): Key | undefined {
  return resolveId({}, takeItemDefaults(), useContext(CollectionContext));
}

/** Dependencies / id scope propagated to nested `Collection`s (RAC `CollectionContext`). */
interface CollectionContextValue {
  readonly idScope?: Key | undefined;
}
const CollectionContext = resumableContext(createContext<CollectionContextValue | null>(null, { id: "rv-collection" }));

/**
 * Run `fn` tracked by the build pass that `build` belongs to. Component bodies run untracked (runtime
 * component creation untracks), so a part re-enters the build's observer before evaluating user content
 * (`items` accessors, function children, nested `Collection`s): a signal read there rebuilds the
 * collection, like React re-rendering RAC's hidden tree. Reads in component *props* expressions stay
 * snapshots (as in live mode).
 */
const tracked = <R,>(build: BuildScope, fn: () => R): R => _reobserve(build.run.o, fn);

/** RAC `useIsHidden`: whether the caller renders in build mode (render nothing visible, register only). */
export function isHidden(): boolean {
  return useContext(HiddenContext) || useContext(BuildContext) != null;
}

// ---------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------

/**
 * Run `content` in build mode and commit the registered nodes into a collection (RAC
 * `CollectionBuilder`'s hidden render + `Document.getCollection`). Tracks the signals `content`
 * reads; call inside a `computed` (`collectionOf`) to rebuild on change.
 */
export function buildCollectionFrom<C extends BaseCollection<any> = BaseCollection<any>>(content: unknown, createCollection?: () => C): C {
  const run: BuildRun = { o: _observer() };
  const scope: BuildScope = { specs: [], parentKey: null, ids: { n: 0 }, run };
  // The build pass renders nothing: keep the resume recorder out of it (no dead regions/ids).
  try {
    _rUnrecorded(() => provide(BuildContext, scope, () => provide(HiddenContext, true, () => tracked(scope, () => evaluate(content)))));
  } finally {
    run.o = null;
  }
  const keyed = typeof content === "function" || (typeof content === "object" && content !== null);
  try {
    const built = buildCollection(scope.specs, createCollection) as C;
    if (keyed) (lastBuilt ??= new WeakMap()).set(content as object, built);
    return built;
  } catch (error) {
    // A rebuild between two unbatched writes (an item moved from one `items` signal to another: added to the first, not
    // yet removed from the second) sees a key twice; RAC never builds that state (React batches the renders). Keep the
    // content's last collection: the build read every source, so the second write rebuilds it. A first build throws.
    const last = keyed ? lastBuilt?.get(content as object) : undefined;
    if (last !== undefined && error instanceof Error && error.message.startsWith("Duplicate key ")) return last as C;
    throw error;
  }
}
/** The last collection each content built (`buildCollectionFrom`'s duplicate-key tolerance on rebuilds). */
let lastBuilt: WeakMap<object, BaseCollection<any>> | undefined;

/**
 * Rivet (server): evaluate `content` in build mode registering nothing, so the collection root in it (ListBox / Menu /
 * …, `isCollectionProbe`) merges its own `id` into the `SelectableCollectionContext` `MergedId` (`contextProps`) before
 * the parent's input renders `aria-controls`. RA merges the ids after the first render (mergeIds re-renders the
 * `useId` holder); a resumed page never re-renders, so its server markup has to carry the merged id. Hideable parts
 * (SearchField, Input, …) render nothing in build mode.
 */
export function probeCollection(content: unknown): void {
  const scope: BuildScope = { specs: [], parentKey: null, ids: { n: 0 }, run: { o: null }, probe: true };
  _rUnrecorded(() => provide(BuildContext, scope, () => provide(HiddenContext, true, () => untrack(() => evaluate(content)))));
}

const COMPILED = Symbol.for("rivet.compiled");
const TEMPLATE = Symbol.for("rivet.template");
const SCOPED = Symbol.for("rivet.server.scoped");

/**
 * @internal Server slot probe walk (`probeSlots`, `./server-on.tsx`): `probeCollection` that also walks the server output
 * as the server renderer does (lazy slots and 0-arity children called, compiled / template records' slots, scoped
 * records under their owner), so a Description in a render-function child or nested in another part's lazy children (a
 * card's ItemContent) is reached. Attribute / spread records and handlers are not called. Cheap because the parts it
 * reaches return early while `slotProbing` is on (ui wrappers, Label / Input / FieldError, nested field owners).
 */
export function _probeTree(content: unknown): void {
  const scope: BuildScope = { specs: [], parentKey: null, ids: { n: 0 }, run: { o: null }, probe: true };
  // No HiddenContext: the hideable parts check `slotProbing` first; `isHidden()` sees the build scope.
  provide(BuildContext, scope, () => probeWalk(evaluate(content), 0));
}

function probeWalk(value: unknown, depth: number): void {
  if (value == null || depth > 200) return;
  if (typeof value === "function") {
    if (isSlot(value) || value.length === 0) probeWalk((value as () => unknown)(), depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) probeWalk(item, depth + 1);
    return;
  }
  const record = value as { [key: symbol]: unknown; slots?: unknown[]; value?: unknown; owner?: Owner | null };
  if (record[COMPILED] || record[TEMPLATE]) {
    for (const slot of record.slots ?? []) probeWalk(slot, depth + 1);
  } else if (record[SCOPED]) {
    const inner = record.value;
    runWithOwner(record.owner ?? null, () => probeWalk(inner, depth + 1));
  }
}

/** Whether the caller renders inside `probeCollection`: a collection root merges the context id and renders nothing. */
export function isCollectionProbe(): boolean {
  return useContext(BuildContext)?.probe === true;
}

/**
 * A reactive collection accessor for `content` (lazy JSX / slot / render function): the Rivet
 * equivalent of reading `CollectionBuilder`'s collection before the item DOM exists (closed
 * popovers). Server: built on first read. Browser: rebuilt when a signal the content reads changes.
 */
export function collectionOf<C extends BaseCollection<any> = BaseCollection<any>>(content: unknown, createCollection?: () => C): () => C {
  return computed(() => buildCollectionFrom(content, createCollection));
}

let builtCollections: WeakMap<object, () => BaseCollection<any>> | undefined;

/**
 * Rivet: the built collection of a virtualized host's `content` (RAC: a collection inside a `Virtualizer` renders
 * from its built collection, only the visible window has parts). One `collectionOf` computed per `instance` (a plain
 * object the host creates in its body: serialized as data, so a resumed page rebuilds the computed from `content` on
 * its first read). Created detached from the reading owner: the first read may be a binding that re-runs (the
 * virtualizer's rows), which would dispose a computed it owns.
 */
export function builtCollectionOf<C extends BaseCollection<any> = BaseCollection<any>>(instance: object, content: unknown, createCollection?: () => C): C {
  let built = (builtCollections ??= new WeakMap()).get(instance);
  if (!built) builtCollections.set(instance, (built = runWithOwner(null, () => collectionOf(content, createCollection))));
  return built() as C;
}

export interface CollectionBuilderProps<C extends BaseCollection<any>> {
  /** The collection content (plain JSX children are lazy). */
  content: unknown;
  /** Renders with the built collection (Rivet: an accessor). */
  children: (collection: () => C) => unknown;
  createCollection?: () => C;
}

/**
 * Builds a `Collection` from the `content` and passes it to `children` (RAC `CollectionBuilder`).
 * Inside another builder's build pass it only renders the content (registers into that build).
 */
export function CollectionBuilder<C extends BaseCollection<any>>(props: CollectionBuilderProps<C>): unknown {
  const { content, children, createCollection } = props;
  const build = useContext(BuildContext);
  if (build) return tracked(build, () => evaluate(content));
  return children(collectionOf(content, createCollection));
}

/** Call lazy content / thunks; arrays element-wise. Results are discarded in build mode. */
function evaluate(content: unknown): unknown {
  if (typeof content === "function" && (isSlot(content) || content.length === 0)) return evaluate((content as () => unknown)());
  if (Array.isArray(content)) {
    if (!isServer && hasThunk(content)) {
      const build = useContext(BuildContext);
      if (build) return evaluateInOrder(content, build.specs);
    }
    return content.map(evaluate);
  }
  return content;
}

// Build-pass order (browser). A children array is built eagerly: its parts register while JSX builds the array, and a
// `{() => …}` / `<Show>` / `<For>` child (an accessor) registers only when `evaluate` calls it, after its siblings. In
// build mode, parts return a per-spec mark (an empty comment: renders nothing; a node, so array copies — the dev
// runtime maps component output — keep it), so the array says where each eager part's spec belongs; an accessor's
// specs go where the accessor sits. Server: the build calls everything in document order already.
let marks: WeakMap<object, CollectionNodeSpec<any>> | undefined;
/** The value a part returns in build mode: `null` on the server, a mark of its spec in the browser. */
const buildMark = (spec: CollectionNodeSpec<any>): unknown => {
  if (isServer) return null;
  // `globalThis.document`: the compiler rejects bare browser globals in a server-rendered module (RV2001).
  const mark = globalThis.document.createComment("");
  (marks ??= new WeakMap()).set(mark, spec);
  return mark;
};
const isThunk = (value: unknown): boolean => typeof value === "function" && (isSlot(value) || value.length === 0);
function hasThunk(content: readonly unknown[]): boolean {
  for (const value of content) if (isThunk(value) || (Array.isArray(value) && hasThunk(value))) return true;
  return false;
}
function evaluateInOrder(content: readonly unknown[], list: CollectionNodeSpec<any>[]): unknown {
  const listed = new Set(list);
  const order: CollectionNodeSpec<any>[] = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) for (const item of value) walk(item);
    else if (isThunk(value)) {
      const start = list.length;
      evaluate(value);
      for (const spec of list.splice(start)) order.push(spec);
    } else if (value !== null && typeof value === "object") {
      const spec = marks?.get(value);
      if (spec && listed.has(spec)) order.push(spec);
    }
  };
  walk(content);
  const placed = new Set(order);
  let at = 0;
  for (const spec of list) if (!placed.has(spec)) list[at++] = spec;
  list.length = at;
  for (const spec of order) list.push(spec);
  return null;
}

/**
 * Live (rendered) content of a host / branch / row, placed inside the caller's providers: slots run now; any other
 * 0-arity function — a `{() => …}` render-function child or a DOM v2 structural accessor (`<For>` / `<Show>` /
 * dynamic fragment child) — stays a reactive child, each read in a scope under the current owner (`_scoped`: context
 * lookups see these providers). Calling it here would read it once, untracked: v2 rows / filtered options would never
 * update. Server: everything now (`evaluate`, see `serverNow`).
 */
function place(content: unknown): unknown {
  if (isServer) return evaluate(content);
  if (isSlot(content)) return place(content());
  if (typeof content === "function" && content.length === 0) return _scoped(() => place((content as () => unknown)()));
  if (Array.isArray(content)) return content.map(place);
  return content;
}

/**
 * `textValue` default (RAC Document): string / number children, else "" (the caller then falls back to
 * `aria-label`). Lazy JSX children are NEVER evaluated here: that would render the part's content a second
 * time outside its providers (stray overlays, double Text / Keyboard). Live mode: the DOM collection reads the
 * item element's text at event time (`./dom.ts` `domTextValue`). Build mode: give `textValue` for non-string
 * children (RAC's warning).
 */
function defaultTextValue(props: Record<string, any>): string {
  const children = props.children;
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  return "";
}

// ---------------------------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------------------------

/** Props every collection part may carry (RAC: `id`, `value`, `textValue` are read by the collection). */
export interface CollectionPartProps {
  id?: Key | undefined;
  value?: unknown;
  textValue?: string | undefined;
  "aria-label"?: string | undefined;
  ref?: RefProp<any> | undefined;
  children?: unknown;
}

function resolveId(props: Record<string, any>, defaults: ItemDefaults | null, scope: { idScope?: Key | undefined } | null): Key | undefined {
  if (props.id != null) return props.id as Key;
  const id = defaults?.id;
  return id != null && scope?.idScope != null ? `${String(scope.idScope)}:${String(id)}` : id;
}

/**
 * Id of a part without `id` (RAC: generated by the collection document): `$.<n>` per parent in
 * document order (`<parentKey>.$.<n>` below a branch), the same in build and live mode, so keys read
 * from the DOM match a built collection's.
 */
function generatedId(parentKey: Key | null | undefined, ids: { n: number }): string {
  return (parentKey == null ? "" : String(parentKey) + ".") + "$." + ids.n++;
}

/** Live-mode node of a part (see header: no sibling links). */
function liveNode<T>(
  NodeClass: CollectionNodeClass<any>,
  props: Record<string, any>,
  id: Key,
  value: unknown,
  scope: CollectionScope | null,
): CollectionNode<T> {
  const node: Mutable<CollectionNode<T>> = new NodeClass(id);
  const [textValue, rest] = nodeProps(props);
  node.props = rest;
  node.value = (value ?? null) as T | null;
  node.textValue = textValue || defaultTextValue(props) || props["aria-label"] || "";
  if (props["aria-label"]) node["aria-label"] = props["aria-label"];
  node.level = scope?.level ?? 0;
  node.parentKey = scope?.parentKey ?? null;
  if (rest.colSpan != null) node.colSpan = rest.colSpan;
  return node;
}

/**
 * A part's node props (`{ id, value, textValue, ...rest } = props`) and whether a prop is live (P5): with an own getter
 * the rest forwards unread (`splitProps`), so the build pass does not depend on a live prop and `node.props.isDisabled`
 * / `class` / … stay live for the selection manager and the part (no node rebuild, no item re-creation). The rest is a
 * fresh object either way (spec `ownProps`: `buildCollection` uses it without a copy).
 */
function nodeProps(props: Record<string, any>): [string | undefined, Record<string, any>, boolean] {
  if (!hasLive(props)) {
    const { id: _id, value: _value, textValue, ...rest } = props;
    return [textValue, rest, false];
  }
  return [untrack(() => props.textValue), splitProps(props, ["id", "value", "textValue"])[1], true];
}

/**
 * The props a built part renders with: `node.props` plus its key / value. Live: the part's own props when no `items`
 * row supplied id / value (they already carry both; no per-render merge), else a merge that keeps the getters.
 */
const withNode = (all: Record<string, any>, direct: boolean, props: Record<string, any>, live: boolean, extra: Record<string, unknown>): any =>
  direct ? all : live ? mergeLive(props, extra) : { ...props, ...extra };

type LeafRender<P, E extends Element, T> = (props: P, ref: RefProp<E> | undefined, node: Node<T>) => unknown;

/**
 * Defines a collection leaf part (RAC `createLeafComponent`): outside a collection it renders
 * `render(props, ref)` (a render taking `node` throws there, as upstream); inside a collection host
 * it renders `render(props, ref, node)` in place (live) or registers a node (build mode).
 */
export function createLeafComponent<P extends object, E extends Element = HTMLElement, T = unknown>(
  CollectionNodeClass: CollectionNodeClass<any> | string,
  render: LeafRender<P, E, T> | ((props: P, ref: RefProp<E> | undefined) => unknown),
): (props: P) => unknown {
  const NodeClass = collectionNodeClass(CollectionNodeClass);
  const name = render.name || "Component";
  return function CollectionLeaf(props: P): unknown {
    const p = props as P & CollectionPartProps;
    const build = useContext(BuildContext);
    const defaults = takeItemDefaults();
    if (build) {
      const collectionCtx = useContext(CollectionContext);
      const all = p as Record<string, any>;
      const [textValue, rest, live] = nodeProps(all);
      const value = all.value ?? defaults?.value;
      // RAC passes node.props as given: `id` only when the user (or an `items` row) supplied one.
      const explicitId = resolveId(all, defaults, collectionCtx);
      const spec: CollectionNodeSpec<any> = {
        type: NodeClass,
        id: explicitId ?? generatedId(build.parentKey, build.ids),
        value: value as never,
        textValue: textValue || defaultTextValue(all),
        "aria-label": all["aria-label"],
        rendered: all.children,
        props: rest,
        ownProps: true,
        render: (node: Node<any>) =>
          (render as LeafRender<P, E, T>)(
            withNode(all, live && !defaults, node.props, live, explicitId == null ? { value: node.value } : { id: node.key, value: node.value }) as P,
            p.ref,
            node as Node<T>,
          ),
      };
      build.specs.push(spec);
      return buildMark(spec);
    }
    const scope = useContext(CollectionScopeContext);
    if (!scope) {
      if (render.length >= 3) throw new Error(name + " cannot be rendered outside a collection.");
      return (render as (props: P, ref: RefProp<E> | undefined) => unknown)(props, p.ref);
    }
    const id = resolveId(p as Record<string, any>, defaults, useContext(CollectionContext)) ?? generatedId(scope.parentKey, scope.ids);
    const value = p.value ?? defaults?.value;
    const node = liveNode<T>(NodeClass, p as Record<string, any>, id, value, scope);
    return (render as LeafRender<P, E, T>)(defaults ? ({ ...props, id, value } as P) : props, p.ref, node);
  };
}

/** RAC useCachedChildren: a branch's `useChildren` sees the explicit / item-default id as `id` (never a generated `$.n` id). */
const childProps = <P,>(props: P, all: Record<string, any>, id: Key | undefined): P => (id == null || all.id === id ? props : ({ ...props, id } as P));

type BranchRender<P, E extends Element, T> = (props: P, ref: RefProp<E> | undefined, node: Node<T>) => unknown;

/**
 * Defines a collection branch part (RAC `createBranchComponent`: sections, tree items, rows with
 * cells). `useChildren(props)` returns the branch's collection children (default: `Collection`
 * semantics over `props.children` / `props.items`). The render gets `node`; render the children with
 * the renderer's `CollectionBranch` (`<CollectionBranch collection={…} parent={node} />`).
 */
export function createBranchComponent<P extends { children?: unknown }, E extends Element = HTMLElement, T = unknown>(
  CollectionNodeClass: CollectionNodeClass<any> | string,
  render: BranchRender<P, E, T>,
  useChildren: (props: P) => unknown = (props) => collectionChildren(props as CollectionProps<unknown>),
): (props: P) => unknown {
  const NodeClass = collectionNodeClass(CollectionNodeClass);
  return function CollectionBranchPart(props: P): unknown {
    const p = props as P & CollectionPartProps;
    const all = p as Record<string, any>;
    const build = useContext(BuildContext);
    const defaults = takeItemDefaults();
    const collectionCtx = useContext(CollectionContext);
    const id = resolveId(all, defaults, collectionCtx);
    const value = all.value ?? defaults?.value;
    if (build) {
      // Live props (P5): getters forwarded unread (as `nodeProps` for leaves); `children` is the branch's own.
      const [textValue, rest, live] = nodeProps(all);
      const key = id ?? generatedId(build.parentKey, build.ids);
      const spec: CollectionNodeSpec<any> & { children: CollectionNodeSpec<any>[] } = {
        type: NodeClass,
        id: key,
        value: value as never,
        textValue: textValue || "",
        "aria-label": all["aria-label"],
        rendered: null,
        props: rest,
        ownProps: true,
        render: (node: Node<any>) =>
          render(
            withNode(all, live && !defaults, node.props, live, id == null ? { value: node.value } : { id: node.key, value: node.value }) as P,
            p.ref,
            node as Node<T>,
          ),
        children: [],
      };
      build.specs.push(spec);
      provide(BuildContext, { specs: spec.children, parentKey: key, ids: { n: 0 }, run: build.run }, () =>
        provide(CollectionItemContext, null, () => tracked(build, () => evaluate(() => useChildren(childProps(props, all, id))))),
      );
      return buildMark(spec);
    }
    const scope = useContext(CollectionScopeContext);
    const key = id ?? generatedId(scope?.parentKey, scope?.ids ?? { n: 0 });
    const node = liveNode<T>(NodeClass, all, key, value, scope) as Mutable<CollectionNode<T>> & { content?: () => unknown };
    node.hasChildNodes = true;
    const childScope: CollectionScope = {
      parentKey: key,
      level: (scope?.level ?? 0) + (NodeClass.type === "item" ? 1 : 0),
      idScope: scope?.idScope,
      ids: { n: 0 },
    };
    node.content = () => (
      <Provider token={CollectionScopeContext} value={childScope}>
        <Provider token={CollectionItemContext} value={null}>
          {place(useChildren(childProps(props, all, id))) as never}
        </Provider>
      </Provider>
    );
    return render(defaults ? ({ ...props, id: key, value } as P) : props, p.ref, node);
  };
}

// ---------------------------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------------------------

export interface CollectionProps<T> {
  /** Item objects in the collection (array or accessor). */
  items?: Iterable<T> | (() => Iterable<T>) | undefined;
  /** Static parts (lazy JSX), or a renderer for `items` returning one part per item. */
  children?: unknown | ((item: T) => unknown);
  /** RAC parity; ignored (Rivet re-renders through signals). */
  dependencies?: readonly unknown[] | undefined;
  /** A scope prepended to the ids of child items (`<idScope>:<id>`) to keep them unique. */
  idScope?: Key | undefined;
}

const toArray = <T,>(items: Iterable<T> | (() => Iterable<T>)): readonly T[] => {
  const value = typeof items === "function" ? (items as () => Iterable<T>)() : items;
  return Array.isArray(value) ? value : [...value];
};

/** Default id of an item object (`item.key ?? item.id`). */
const itemId = (item: unknown): Key | undefined => {
  if (item == null || typeof item !== "object") return undefined;
  const o = item as { key?: Key; id?: Key };
  return o.key ?? o.id;
};

/**
 * The children of a collection or branch (RAC `useCachedChildren` with `addIdAndValue`): static
 * content as is; `items` + renderer → one row per item, its part defaulting `id` to `item.key ??
 * item.id` and `value` to the item.
 */
export function collectionChildren<T>(props: CollectionProps<T>): unknown {
  const { items, children } = props;
  // A per-item renderer (`(item) => …`, arity ≥ 1) without items renders nothing (RAC useCachedChildren). Told
  // apart from lazy content: compiler slots and 0-arity thunks (`{() => …}` render-function children, kept for
  // resumability) are content and render as is.
  if (items == null) return typeof children === "function" && !isSlot(children) && children.length > 0 ? null : children;
  if (typeof children !== "function" || isSlot(children)) return children;
  const render = children as (item: T) => unknown;
  const build = useContext(BuildContext);
  if (build) {
    // Build mode: synchronous loop, tracked by the build (an `items` signal / accessor rebuilds the collection).
    return tracked(build, () => toArray(items).map((item) => provide(CollectionItemContext, { id: itemId(item), value: item }, () => evaluate(render(item)))));
  }
  const each = () => toArray(items);
  return (
    <For each={each} by={(item: T, index?: number) => itemId(item) ?? (index as number)}>
      {(item: () => T) => {
        // Reactive row: a new item object under the same key (or index) re-renders the row's part.
        const row = () => {
          const value = item(); // tracked here: component bodies run untracked
          return (
            <Provider token={CollectionItemContext} value={{ id: itemId(value), value }}>
              {place(render(value)) as never}
            </Provider>
          );
        };
        // A function child is a dynamic region (re-runs when `item()` changes). Server: evaluated in the row
        // (see `serverNow`).
        return serverNow(row) as never;
      }}
    </For>
  );
}

const isServer = typeof document === "undefined";
/**
 * A dynamic row region (`For` row callback returning a function) as the row's content. Server: evaluated right
 * away — a function value is otherwise rendered after the row's resume scope closed, so the part's bindings would
 * belong to the page root instead of the row region and outlive a row the resumed list drops ("Missing resumable
 * element", stale computeds reading a removed key). Runtime gap: function children are not server resume regions.
 */
const serverNow = (row: () => unknown): unknown => (isServer ? row() : row);

/** A Collection renders a list of items, automatically managing ids and values (RAC `Collection`). */
export function Collection<T>(props: CollectionProps<T>): unknown {
  const ctx = useContext(CollectionContext);
  const idScope = props.idScope ?? ctx?.idScope;
  // Build mode: synchronous (a server `Provider` defers its children; the build must register now).
  const build = useContext(BuildContext);
  if (build) return provide(CollectionContext, { idScope }, () => tracked(build, () => evaluate(collectionChildren(props))));
  return (
    <Provider token={CollectionContext} value={{ idScope }}>
      {place(collectionChildren(props)) as never}
    </Provider>
  );
}

// ---------------------------------------------------------------------------------------------
// Renderers (RAC Collection.tsx)
// ---------------------------------------------------------------------------------------------

/** RAC `ItemRenderProps` (Rivet: values are read inside bindings — the render-prop object is reactive). */
export interface ItemRenderProps {
  /** @selector [data-hovered] */
  isHovered: boolean;
  /** @selector [data-pressed] */
  isPressed: boolean;
  /** @selector [data-selected] */
  isSelected: boolean;
  /** @selector [data-focused] */
  isFocused: boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: boolean;
  /** @selector [data-disabled] */
  isDisabled: boolean;
  /** @selector [data-selection-mode="single | multiple"] */
  selectionMode: SelectionMode;
  selectionBehavior: SelectionBehavior;
  /** @selector [data-allows-dragging] */
  allowsDragging?: boolean;
  /** @selector [data-dragging] */
  isDragging?: boolean;
  /** @selector [data-drop-target] */
  isDropTarget?: boolean;
}

export interface CollectionBranchProps {
  /** The collection of items to render (a built collection or an accessor of one; null in live mode). */
  collection: CollectionInput;
  /** The parent node of the items to render. */
  parent: Node<unknown>;
  /** A function that renders a drop indicator between items (DnD, C8). */
  renderDropIndicator?: ((target: { type: "item"; key: Key; dropPosition: "before" | "after" | "on" }) => unknown) | undefined;
}

export interface CollectionRootProps {
  /**
   * The built collection to render from (`node.render(node)` per node) or an accessor of one (a
   * changing collection updates the keyed rows in place), or null: live mode, render `content` in place.
   */
  collection: CollectionInput;
  /** Rivet: the host's collection content (live mode), lazy: a slot / thunk evaluated inside the root scope. */
  content?: unknown;
  /** Rivet: id scope of the root (live mode). */
  idScope?: Key | undefined;
  /** A set of keys for items that should always be persisted in the DOM (virtualizers). */
  persistedKeys?: Set<Key> | null | undefined;
  /**
   * Rivet: the host's focused key (an accessor, e.g. the selection state's `focusedKey` signal): virtualizers keep it
   * rendered (RAC `usePersistedKeys(focusedKey)`; a signal, not a set, so it resumes without a closure over the host state).
   */
  focusedKey?: (() => Key | null) | undefined;
  /** The scroll container (virtualizers). */
  scrollRef?: unknown;
  renderDropIndicator?: CollectionBranchProps["renderDropIndicator"];
}

export interface CollectionRenderer {
  /** Whether this is a virtualized collection (hosts then build the collection and pass it). */
  isVirtualized?: boolean | undefined;
  /** A delegate object that provides layout information for items in the collection. */
  layoutDelegate?: LayoutDelegate | undefined;
  /** A delegate that provides drop targets for pointer coordinates (DnD, C8). */
  dropTargetDelegate?: unknown;
  /** Renders the root collection items. */
  CollectionRoot: (props: CollectionRootProps) => unknown;
  /** Renders the child items of a branch. */
  CollectionBranch: (props: CollectionBranchProps) => unknown;
  /**
   * Rivet: the host forwards its scroll container's `scroll` events here (virtualizers: the engine follows the scroll
   * position; RAC's useScrollView listens on `scrollRef` itself, a resumed page needs the host element's handler).
   */
  onScroll?: ((event: Event) => void) | undefined;
}

/** A built collection, an accessor of one, or null (live mode). */
export type CollectionInput = ICollection<Node<unknown>> | (() => ICollection<Node<unknown>>) | null | undefined;

/** The collection of a `CollectionInput` (reads the accessor). */
export const resolveCollection = (collection: CollectionInput): ICollection<Node<unknown>> | null =>
  typeof collection === "function" ? collection() : (collection ?? null);

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};
/**
 * Two values render the same: identical, or two functions of the same source (lazy children / render
 * functions re-created by a rebuild: what they capture comes from the node's props / value, compared alongside;
 * signals they read stay live bindings).
 */
const sameField = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) || (typeof a === "function" && typeof b === "function" && isSlot(a) === isSlot(b) && a.length === b.length && String(a) === String(b));
/** Shallow equality of plain objects (props, item values), skipping the `live` keys. */
function sameShallow(a: unknown, b: unknown, live: readonly string[] | undefined): boolean {
  if (Object.is(a, b)) return true;
  if (!isPlain(a) || !isPlain(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) if (!(k in b) || (!live?.includes(k) && !sameField(a[k], b[k]))) return false;
  return true;
}

/**
 * Whether a rebuilt node renders like the previous one (Rivet: RAC keeps the DOM through React's reconciliation;
 * a Rivet part is re-created): same class / key / text, render inputs (`rendered`, shallow `props` and item `value`)
 * equal. Sibling links / index / level are not compared: parts read those live from the collection by key.
 */
export function sameRender(a: Node<unknown> | null | undefined, b: Node<unknown> | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.constructor !== b.constructor || a.key !== b.key || a.textValue !== b.textValue || a["aria-label"] !== b["aria-label"]) return false;
  const live = (a.constructor as CollectionNodeClass<unknown>).liveProps;
  return sameField(a.rendered, b.rendered) && sameShallow(a.props, b.props, live) && sameShallow(a.value, b.value, live);
}

/**
 * Renders the node at `key` of a built collection (a keyed row of `CollectionRoot` / `CollectionBranch` and the
 * hosts' own node loops): a dynamic region that keeps the rendered part (DOM, focus) across rebuilds while the
 * node renders the same (`sameRender`) and re-renders it when its render inputs changed, or when `depends` (read in the
 * region) changes: a part whose content renders from its parent's value (TreeItemContent).
 */
export function renderNodeAt(collection: () => ICollection<Node<unknown>> | null | undefined, key: () => Key | RowBox, depends?: () => unknown): unknown {
  // Server: rendered once, untracked. `depends` / the cut-off `node` are the browser region's re-render triggers; read
  // in a resumable row they would count as the row's own reads, so the resumed For re-created the row on every re-run
  // of its region (a sort re-created the table header and body: focus lost) instead of keeping it like a client rebuild.
  if (isServer)
    return untrack(() => {
      const n = collection()?.getItem(rowKey(key())) ?? null;
      // DOM-DATA servers: the row's data object (the For iterates keys), registered with the row (`domRowItem`).
      if (n !== null) domRowItem(n.value);
      return n?.render ? n.render(n) : null;
    });
  const node = computed(() => collection()?.getItem(rowKey(key())) ?? null, { equals: sameRender });
  return serverNow(() => {
    depends?.();
    node();
    // The current node (the cut-off computed keeps the first of equal ones; `depends` re-renders with the latest).
    const n = untrack(() => collection()?.getItem(rowKey(key())) ?? null);
    return n?.render ? untrack(() => n.render!(n)) : null;
  });
}

/**
 * Lazy collection rows (`resume.lazyRows`, LAZY-T6): a loop over container nodes — a section, a table's header / body (nodes
 * whose children have children) — is not the lazy `For`; the rows below it are (a lazy row is one option / table row, not a
 * whole table body). Read by the server's lazy rows only.
 */
function leafNodes(collection: CollectionInput, parent: Node<unknown> | null): boolean {
  const c = resolveCollection(collection);
  if (!c?.getChildren) return true;
  for (const n of parent ? c.getChildren(parent.key) : c) {
    if (n.type === "content") continue;
    if (n.type === "section") return false;
    // No children (built nodes keep `firstChildKey`): no iterator per leaf (LAZY-COST-2: 1000 options ≈ 0.5 ms / render).
    if ((n as { firstChildKey?: Key | null }).firstChildKey === null) continue;
    for (const child of c.getChildren(n.key)) {
      for (const _ of c.getChildren(child.key)) return false;
      break;
    }
  }
  return true;
}

/**
 * The nodes a row of `n` renders (its stamp covers them): `n`, and a section's items / a table row's cells — a nested `For`
 * inside the row (`CollectionBranch`) that keeps no baseline of its own (`serverRows`).
 */
function rowNodes(c: ICollection<Node<unknown>>, n: Node<unknown>): Node<unknown>[] {
  const row = [n];
  if (n.firstChildKey != null && c.getChildren) for (const child of c.getChildren(n.key)) if (n.type === "section" || child.type === "cell") row.push(child);
  return row;
}
/** The stamp of a row's nodes (`row-stamps.ts`). */
const rowStamp = (row: Node<unknown>[]): string => stamp(row[0], row.length > 1 ? row.slice(1) : null);

/**
 * Server baseline of a resumed For over collection keys (ROW-RERENDER): `_regionState` with the stamps of the rows the server
 * renders (`row-stamps.ts`) when the collection is an accessor whose build read signals (a static collection never rebuilds:
 * null), recorded with the For's region; none (no slot) for the children of a section / table row (`parentType`). Called by the server and the browser alike (one `_regionState` slot per accessor
 * collection, so the region's other slots keep their positions); the browser gets the server's value back when it
 * re-creates that region (adopting the rows), null otherwise.
 */
export function serverRows(collection: CollectionInput, keys: () => readonly Key[], parentType?: string | undefined): string | null {
  // The rows of a section / a table row: covered by the stamp of the row holding them (`rowNodes`). Decided by the
  // parent node's type alone (the same on the server and in the browser: the `_regionState` slot is positional).
  if (typeof collection !== "function" || parentType === "section" || parentType === "item") return null;
  return _regionState(() => {
    if (!isServer) return null;
    // `_trackReads` through the slot (`_tracker`, installed by the server resume runtime): a static import would ship
    // `@rivetjs/reactivity/track` to the browser with this module. Null = no resumable render, nothing records stamps.
    const track = _tracker();
    if (!track) return null;
    return untrack(() => {
      const c = track(collection);
      if (!c.signals.length || !c.value) return null;
      let out = "";
      for (const k of keys()) {
        const n = c.value.getItem(k);
        out += n ? rowStamp(rowNodes(c.value, n)) : stamp(null);
      }
      return out || null;
    });
  });
}

/**
 * The keys of a resumed For over collection keys (`renderNodeAt` rows), given the server baseline (`serverRows`): an adopted
 * server row keeps its key while its node renders like the server's (stamp in the baseline; then `sameRender` against the
 * last node checked), else its key is boxed (`RowBox`, one box per key for good) — a key the adopted list does not know, so
 * the For re-creates that row (rows read `rowKey(key())`). Rows the server did not render get a box too (created anyway).
 * Without a baseline: `keys` itself.
 */
export function resumedKeys(collection: CollectionInput, base: string | null, keys: () => readonly Key[]): () => readonly (Key | RowBox)[] {
  if (base === null || isServer) return keys;
  let set: Set<string> | null = null;
  const boxes = new Map<Key, RowBox>(),
    // The last node (`rowNodes`: + its items / cells) found to render like the server's, per key.
    seen = new Map<Key, Node<unknown>[]>();
  return () => {
    const list = keys(),
      c = resolveCollection(collection);
    return untrack(() => {
      set ??= stampSet(base);
      let out: (Key | RowBox)[] | null = null;
      for (let i = 0; i < list.length; i++) {
        const k = list[i]!;
        let box = boxes.get(k);
        if (box === undefined) {
          const n = c?.getItem(k) ?? null;
          if (n === null) continue;
          const row = rowNodes(c!, n),
            last = seen.get(k);
          // Unchanged since the last check (`sameRender`, node by node): no stamp.
          if (last !== undefined && last.length === row.length && row.every((x, j) => sameRender(last[j], x))) continue;
          if (set.has(rowStamp(row))) {
            seen.set(k, row);
            continue;
          }
          seen.delete(k);
          boxes.set(k, (box = { k }));
        }
        (out ??= list.slice())[i] = box;
      }
      return out ?? list;
    });
  };
}

function renderNodes(collection: CollectionInput, parent: Node<unknown> | null, parentType?: string): unknown {
  // Rows are keyed by primitive keys (stable across rebuilds) so an adopted (resumed) row survives a
  // collection rebuild; a row re-renders only when its node's render inputs changed (`renderNodeAt`) and parts
  // read live data by key. An adopted row whose node changed since the server render is re-created (`resumedKeys`).
  const keys = (): readonly Key[] => {
    const c = resolveCollection(collection)!;
    const keys: Key[] = [];
    for (const n of parent ? c.getChildren!(parent.key) : c) if (n.type !== "content") keys.push(n.key);
    return keys;
  };
  const each = resumedKeys(collection, serverRows(collection, keys, parentType), keys);
  return (
    <For each={each} by={(key: Key | RowBox) => key} lazy={() => leafNodes(collection, parent)}>
      {(key: () => Key | RowBox) => renderNodeAt(() => resolveCollection(collection), key) as never}
    </For>
  );
}

/** RAC `DefaultCollectionRenderer`: built collections render node by node; live mode renders content in place. */
export const DefaultCollectionRenderer: CollectionRenderer = {
  CollectionRoot(props: CollectionRootProps): unknown {
    const { collection, content, idScope } = props;
    if (collection) return renderNodes(collection, null);
    return (
      <Provider token={CollectionScopeContext} value={{ parentKey: null, level: 0, idScope, ids: { n: 0 } }}>
        {place(content) as never}
      </Provider>
    );
  },
  CollectionBranch(props: CollectionBranchProps): unknown {
    const { collection, parent } = props;
    // `parent` may be row data (`{ key }`, a resumable capture), not the node: its type comes from the collection.
    const node = collection ? untrack(() => resolveCollection(collection)?.getItem(parent.key)) : null;
    if (node) return renderNodes(collection, parent, node.type);
    return ((parent as { content?: () => unknown }).content?.() ?? null) as never;
  },
};

/** RAC `CollectionRendererContext` (Virtualizer provides its own renderer). */
export const CollectionRendererContext = createContext<CollectionRenderer>(DefaultCollectionRenderer);

/** RAC `usePersistedKeys`: the focused key stays rendered (virtualizers). */
export function persistedKeys(focusedKey: Key | null): Set<Key> | null {
  return focusedKey != null ? new Set([focusedKey]) : null;
}

// ---------------------------------------------------------------------------------------------
// Section (deprecated upstream; kept as RAC exports it)
// ---------------------------------------------------------------------------------------------

export interface SectionProps<T> extends CollectionProps<T> {
  /** The unique id of the section. */
  id?: Key | undefined;
  /** The object value that this section represents (set automatically in dynamic collections). */
  value?: T | undefined;
  "aria-label"?: string | undefined;
  class?: string | undefined;
  style?: unknown;
  [attr: `data-${string}`]: unknown;
}

interface SectionContextValue {
  /** Name of the collection-specific section part (deprecation message). */
  name: string;
  render: (props: SectionProps<any>, ref: RefProp<HTMLElement> | undefined, section: Node<any>, className?: string) => unknown;
}

/** Provided by hosts so a generic `<Section>` renders as their section part (RAC `SectionContext`). */
export const SectionContext = createContext<SectionContextValue | null>(null);

/** @deprecated Use the collection's section part (`ListBoxSection`, `MenuSection`, …). */
export const Section = /* @__PURE__ */ createBranchComponent("section", function Section<
  T,
>(props: SectionProps<T>, ref: RefProp<HTMLElement> | undefined, section: Node<T>) {
  const ctx = useContext(SectionContext)!;
  return ctx.render(props, ref, section, "rv-Section");
});
