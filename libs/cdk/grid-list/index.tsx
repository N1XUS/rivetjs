// Ported from react-aria-components (src/GridList.tsx), Apache-2.0, © Adobe.
//
// GridList, GridListItem, GridListSection, GridListHeader, GridListLoadMoreItem + contexts: a list of
// interactive rows (role grid) with keyboard navigation (stack / grid layout, vertical / horizontal,
// RTL), selection, row actions, links, sections, empty state and infinite loading, on THE
// @react-aria/gridlist port (`./behaviour.ts`).
//
// Rivet:
// - Rows render from the built collection (below; `data-key` on the row); the handlers read it per event
//   (`listStateView(state, shared)` → `listCollection(state)`). Resumed pages ship no item model: the collection is
//   rebuilt from the content, the grid and its rows resume from serializable state only (`createListState` signals +
//   keys + plain item props).
// - Row attributes are computed per row from a one-node collection of the row's own props
//   (`rowCollection(spec)`) inside a `computed` (selection / focus / disabled reads are reactive);
//   handlers rebuild the row node from the DOM collection per event (`eventNode`).
// - Render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`). Hover /
//   focus-visible states are written on the element by the handlers (`data-hovered`,
//   `data-focus-visible`, `data-focus-visible-within`, `data-pressed`); signals back them only when a
//   `class` / `style` / `children` function asks for render props.
// - `className` → `class` (default `rv-GridList`, `rv-GridListItem`, `rv-GridListSection`,
//   `rv-GridListHeader`, `rv-GridListLoadingIndicator`).
// - The GridList builds its collection (`computed(buildCollectionFrom(content))` in the body; LAZY-ROWS T3, 2026-10-19:
//   always, virtualized only before): rows render from it through the renderer's keyed `For` (`renderNodeAt`, lazy-row
//   eligible), handlers navigate it; a resumed page rebuilds it from the content on first need. Inside a
//   `<CollectionVirtualizer layout={ListLayout | GridLayout}>` (RAC Virtualizer) rows render as views, the grid element
//   is the scroll container (scroll forwarded to the renderer), the focused row is persisted, rows get `aria-rowindex`.
// Deviation: `isEmpty` is known for `items` collections and, when `renderEmptyState` is set, for static
//   children (the built collection's size); static children without `renderEmptyState` count as non-empty.
// Deviation: react-aria `useHasTabbableChild` (empty state with a tabbable child) is not tracked: an
//   empty grid is always tabbable.
// Deviation: the description / section heading ids (react-aria `useSlotId`) are always set on the
//   server (like React SSR); in the browser they follow whether the part rendered.
// `render` (RAC DOMRenderProps) on GridList / GridListItem / GridListSection / GridListHeader: given, the attributes object goes to `render(attrs, renderProps)` instead of the default element. Deviation: no `FocusScope`. The SharedElementTransition scope is a `SharedElementContext` provider entry.
// Integration points: drag and drop (`dragAndDropHooks`, drop indicators, drag preview, `slot="drag"`
//   button) — C8; `SelectableCollectionContext` filtering (Autocomplete) — C2b; `ListStateContext` — B5
//   ListBox.
import { computed, createContext, onCleanup, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { buildCollection, HeaderNode, ItemNode, LoaderNode, SectionNode } from "../collections/base.ts";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  buildCollectionFrom,
  createBranchComponent,
  createLeafComponent,
  type CollectionInput,
  type CollectionProps,
} from "../collections/components.tsx";
import { createListState, listSelectionManager, type ListState } from "../collections/list-state.ts";
import type {
  Collection as ICollection,
  DisabledBehavior,
  Key,
  KeyboardDelegate,
  Node,
  Orientation,
  Selection,
  SelectionBehavior,
  SelectionMode,
} from "../collections/types.ts";
import { ListKeyboardDelegate, searchCollator } from "../selection/list-keyboard-delegate.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  dataBool,
  focusStateBlur,
  focusStateFocus,
  hoverStateEnter,
  hoverStateLeave,
  setDataAttr,
  type InteractionStateOptions,
} from "../utils/data-attrs.tsx";
import { focusRingBlur, focusRingFocus } from "../focus/focus-ring.tsx";
import { useRouter, type LinkDOMProps } from "../utils/links.tsx";
import { useLocale } from "../i18n/index.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import type { HoverEvents } from "../utils/types.ts";
import type { PressEvents } from "../interactions/press.tsx";
import {
  Provider,
  DEFAULT_SLOT,
  contextProps,
  createSlotId,
  mergeRefValues,
  isSlotId,
  renderProps as resolveRenderProps,
  type ContextValue,
  type RefValue,
  type SlotId,
  type SlotProps,
  type StyleObject,
  type StyleRenderProps,
  type RenderProps,
} from "../slots/index.tsx";
import { ButtonContext } from "../button/index.tsx";
import { CheckboxContext, CheckboxFieldContext } from "../checkbox/index.tsx";
import { createId } from "../utils/id.ts";
import { TextContext } from "../text/index.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { SharedElementContext, type SharedElementScope } from "../shared-element-transition/transition.tsx";
import { loadMoreSentinel } from "../utils/load-more-sentinel.tsx";
import { SelectableCollectionContext, type SelectableCollectionContextValue } from "../autocomplete/contexts.ts";
import { eventNode, isFn, ringOf, rowCollection, rowSpec, slotRef, withDisabled, type RowSpec } from "./row.ts";
import {
  gridListBlur,
  gridListAutoFocus,
  gridListFocus,
  gridListHighlightDescription,
  gridListItemClick,
  gridListItemDoubleClick,
  gridListItemDragStart,
  gridListItemFocus,
  gridListItemKeyDown,
  gridListItemKeyDownCapture,
  gridListItemKeyUp,
  gridListItemPointerCancel,
  gridListItemPointerDown,
  gridListItemPointerUp,
  gridListItemProps,
  gridListRowIndex,
  gridListKeyDown,
  gridListKeyDownCapture,
  gridListMouseDown,
  gridListProps,
  gridListSectionProps,
  gridListSelectionCheckboxChange,
  gridListSelectionCheckboxProps,
  listStateView,
  type AriaGridListItemOptions,
  type AriaGridListOptions,
  type GridListShared,
  type GridListStateLike,
} from "./behaviour.ts";
import { hasLive, isLive, liveKeys, liveView } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export type { Key, Selection, SelectionMode, SelectionBehavior, Orientation } from "../collections/types.ts";
export type { ListState } from "../collections/list-state.ts";

// --- GridList ------------------------------------------------------------------------------------

/** RAC `GridListRenderProps` (accessors: call them inside bindings). */
export interface GridListRenderProps {
  /** Whether the list has no items and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
  /** Whether the grid list is currently focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the grid list is currently keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the grid list is currently the active drop target. @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** Whether the items are arranged in a stack or grid. @selector [data-layout="stack | grid"] */
  layout: "stack" | "grid";
  /** The primary orientation of the items. @selector [data-orientation="vertical | horizontal"] */
  orientation: Orientation;
  /** State of the grid list. */
  state: ListState;
}

export interface GridListProps<T = object>
  extends
    CollectionProps<T>,
    StyleRenderProps<GridListRenderProps>,
    SlotProps,
    DOMRenderProps<"div", GridListRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The element's unique identifier (default: generated). */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** The type of selection that is allowed in the collection. */
  selectionMode?: SelectionMode;
  /** How multiple selection should behave in the collection. Default "toggle". */
  selectionBehavior?: SelectionBehavior;
  /** The currently selected keys: a signal (two-way) or a value (controlled). */
  selectedKeys?: Signal<Selection> | "all" | Iterable<Key>;
  /** The initial selected keys in the collection (uncontrolled). */
  defaultSelectedKeys?: "all" | Iterable<Key>;
  /** Handler that is called when the selection changes. */
  onSelectionChange?: (keys: Selection) => void;
  /** The item keys that are disabled. These items cannot be selected, focused, or otherwise interacted with. */
  disabledKeys?: Iterable<Key>;
  /** Whether `disabledKeys` applies to all interactions, or only selection. Default "all". */
  disabledBehavior?: DisabledBehavior;
  /** Whether the collection allows empty selection. */
  disallowEmptySelection?: boolean;
  /** Whether `onSelectionChange` fires even if the new set of keys is the same as the last. */
  allowDuplicateSelectionEvents?: boolean;
  /** Whether pressing the escape key should clear selection in the grid list or not. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none";
  /** Handler that is called when a user performs an action on an item. */
  onAction?: (key: Key) => void;
  /** Whether focus should wrap around when the end/start is reached. */
  shouldFocusWrap?: boolean;
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean;
  /** Whether typeahead navigation is disabled. */
  disallowTypeAhead?: boolean;
  /** Whether keyboard navigation to focusable elements within grid list items is via the left/right arrow keys or the tab key. Default "arrow". */
  keyboardNavigationBehavior?: "arrow" | "tab";
  /** Whether the items are arranged in a stack or grid. Default "stack". */
  layout?: "stack" | "grid";
  /** The primary orientation of the items. Usually this is the direction that the collection scrolls. Default "vertical". */
  orientation?: Orientation;
  /** Whether to auto focus the gridlist or an option. */
  autoFocus?: boolean | "first" | "last";
  /** Whether the first or last item is focused when tabbing into the collection with no focused key. */
  UNSTABLE_focusOnEntry?: "first" | "last";
  /** Provides content to display when there are no items in the list. */
  renderEmptyState?: (props: GridListRenderProps) => unknown;
  /** Handler for the grid element's scroll event. */
  onScroll?: (e: Event) => void;
  /** An optional keyboard delegate implementation for type to select. */
  keyboardDelegate?: KeyboardDelegate;
  /** Drag and drop hooks (C8 integration point; currently ignored). */
  dragAndDropHooks?: unknown;
  /** The inline style of the element. A function may be provided to compute the style based on component state. */
  style?: StyleRenderProps<GridListRenderProps>["style"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `GridListContext`. */
export const GridListContext = createContext<ContextValue<GridListProps<any>, HTMLDivElement>>(null);

/** What a GridList provides its parts (Rivet: RAC passes `ListStateContext` + `useGridList`'s `listMap`). */
export interface GridListInternal {
  state: ListState;
  shared: GridListShared;
  locale: string;
  direction: "ltr" | "rtl";
  keyboardNavigationBehavior: "arrow" | "tab";
  isVirtualized: boolean;
  /** Changes when the items change (load-more sentinel dependency). */
  version: () => unknown;
  /** Autocomplete filter (SelectableCollectionContext): rows it returns false for do not render. */
  filter?: ((textValue: string, node: Node<any>) => boolean) | undefined;
  /** Rivet: the built collection of a virtualized GridList (rows read their `aria-rowindex` from it). */
  collection?: (() => ICollection<Node<any>>) | undefined;
}
/** The GridList a part renders in (null outside a GridList, and inside a row's content). */
export const GridListInternalContext = createContext<GridListInternal | null>(null);

const GRID_OWNED = ["onMouseDown", "onScroll", "style"] as const;

/** A grid list displays a list of interactive items, with support for keyboard navigation, single or multiple selection, and row actions (RAC `GridList`). */
export function GridList<T extends object>(inProps: GridListProps<T>) {
  const [ownProps, ownRef] = contextProps(inProps, inProps.ref, GridListContext) as [GridListProps<T>, RefValue<HTMLDivElement> | undefined];
  // RAC GridListInner: an Autocomplete passes its collection props (filter, typeahead, autoFocus, focusin).
  const [props, ref] = contextProps(
    ownProps as GridListProps<T> & SelectableCollectionContextValue<T>,
    ownRef as RefValue<HTMLElement> | undefined,
    SelectableCollectionContext as never,
  ) as [GridListProps<T> & SelectableCollectionContextValue<T>, RefValue<HTMLDivElement> | undefined];
  // Resumable closures / bags read locals only: a `props.x` read would capture the whole props object.
  const { items, children, idScope, renderEmptyState, onMouseDown, onScroll, onAction, shouldSelectOnPressUp, escapeKeyBehavior } = props;
  const { keyboardDelegate, shouldFocusWrap, UNSTABLE_focusOnEntry, autoFocus, disallowTypeAhead, filter } = props;
  const onFocusInCtx = props.onFocusIn;
  const ariaLabel = props["aria-label"],
    ariaLabelledby = props["aria-labelledby"],
    ariaDescribedby = props["aria-describedby"],
    ariaDetails = props["aria-details"];
  const layout = props.layout ?? "stack",
    orientation = props.orientation ?? "vertical";
  const keyboardNavigationBehavior = layout === "grid" ? "tab" : (props.keyboardNavigationBehavior ?? "arrow");
  const renderer = useContext(CollectionRendererContext);
  // Resumable: the lazy collection slot captures `customRenderer` (undefined for the default renderer,
  // whose functions are not serializable; the default is a module import in the symbol).
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const sharedElements: SharedElementScope = {};
  const isVirtualized = !!renderer.isVirtualized,
    layoutDelegate = renderer.layoutDelegate;
  const { locale, direction } = useLocale();
  const content = () => (
    <Collection items={items} idScope={idScope}>
      {children}
    </Collection>
  );
  // The list renders from its built collection (RAC: inside a Virtualizer only the visible window has rows; the
  // handlers navigate the built collection, not the rendered DOM; LAZY-ROWS T3: every GridList, so its rows are the rows
  // of the renderer's keyed `For`). A computed in the body: the compiler records it as a resumable computed (with the
  // host's provider frame), so a resumed page rebuilds it from `content` on its first read.
  const collection = computed(() => buildCollectionFrom(content) as unknown as ICollection<Node<T>>);
  const state = createListState<T>({
    id: props.id,
    collection,
    selectionMode: props.selectionMode,
    selectionBehavior: props.selectionBehavior,
    // Live props: a controlled `selectedKeys={keys()}` stays live (accessor; never written).
    selectedKeys: liveKeys(props, "selectedKeys"),
    defaultSelectedKeys: props.defaultSelectedKeys,
    onSelectionChange: props.onSelectionChange,
    disabledKeys: props.disabledKeys,
    disabledBehavior: props.disabledBehavior,
    disallowEmptySelection: props.disallowEmptySelection,
    allowDuplicateSelectionEvents: props.allowDuplicateSelectionEvents,
    layoutDelegate,
  });
  const shared: GridListShared = {
    id: state.id,
    onAction,
    linkBehavior: "action",
    keyboardNavigationBehavior,
    shouldSelectOnPressUp,
  };
  const descriptionId = state.id + "-description";
  const options: AriaGridListOptions = {
    id: state.id,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    "aria-details": ariaDetails,
    autoFocus: read(autoFocus),
    onAction,
    shouldSelectOnPressUp,
    keyboardNavigationBehavior,
    escapeKeyBehavior,
    isVirtualized,
    disallowTypeAhead: read(disallowTypeAhead),
    keyboardDelegate,
    layoutDelegate,
    shouldFocusWrap,
    UNSTABLE_focusOnEntry,
    direction,
    locale,
    orientation,
    descriptionId,
  };
  // Per event: the DOM collection + a ListKeyboardDelegate for the layout (RAC GridListInner).
  const view = (): GridListStateLike<T> => listStateView(state, shared);
  const eventOptions = (v: GridListStateLike<T>, el: HTMLElement): AriaGridListOptions => ({
    ...options,
    autoFocus: read(autoFocus),
    disallowTypeAhead: read(disallowTypeAhead),
    keyboardDelegate:
      options.keyboardDelegate ??
      new ListKeyboardDelegate({
        collection: v.collection,
        collator: searchCollator(locale),
        ref: el,
        disabledKeys: v.disabledKeys,
        disabledBehavior: v.selectionManager.disabledBehavior,
        layoutDelegate: options.layoutDelegate,
        layout,
        orientation,
        direction,
      }),
  });

  const itemsOf = items;
  const isEmpty: () => boolean =
    itemsOf != null
      ? () => {
          const list = typeof itemsOf === "function" ? (itemsOf as () => Iterable<T>)() : itemsOf;
          for (const _ of list) return false;
          return true;
        }
      : renderEmptyState
        ? () => collection().size === 0
        : () => false;
  const version = itemsOf != null ? (typeof itemsOf === "function" ? (itemsOf as () => unknown) : () => itemsOf) : () => null;

  const wantsStates = isFn(props.class) || isFn(props.style) || !!renderEmptyState;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const ring: InteractionStateOptions = { states: wantsStates ? { isFocused: focused, isFocusVisible: focusVisible } : undefined };
  const values: GridListRenderProps = {
    isEmpty,
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    isDropTarget: () => false,
    layout,
    orientation,
    state,
  };
  const rp = untrack(() =>
    resolveRenderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-GridList" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  // Grid attributes (reactive): the render view only needs the size and the focused key.
  const gridAttrs = computed(() => {
    const empty = isEmpty();
    const none = buildCollection<T>([]);
    const v: GridListStateLike<T> = {
      // Virtualized: the built collection (useGridList `aria-rowcount` = its size).
      collection: isVirtualized ? collection() : ({ ...none, size: empty ? 0 : 1 } as unknown as ICollection<Node<T>>),
      selectionManager: listSelectionManager(state, none),
      disabledKeys: state.disabledKeys,
      list: shared,
    };
    return gridListProps(options, v).gridProps;
  });
  const highlight = () => {
    const collection = buildCollection<T>([]);
    return gridListHighlightDescription(options, {
      collection,
      selectionManager: listSelectionManager(state, collection),
      disabledKeys: state.disabledKeys,
      list: shared,
    });
  };
  const internal: GridListInternal = { state, shared, locale, direction, keyboardNavigationBehavior, isVirtualized, version, filter, collection };
  const dom = globalDOMProps(props, GRID_OWNED);
  const slot = props.slot || undefined;
  const gridEl = createRef<HTMLDivElement>();
  const rootRef = mergeRefValues<HTMLDivElement>(ref, gridEl);
  // Virtualized: the grid element is the scroll container (RAC scrollRef); its focused row stays rendered and its
  // scroll events reach the renderer (the engine follows the scroll position).
  const rootCollection = collection;
  const focusedKey = isVirtualized ? state.selectionState.focusedKey : undefined;
  const virtualScroll = isVirtualized ? customRenderer?.onScroll : undefined;
  const scrolled = (e: Event) => {
    virtualScroll?.(e);
    onScroll?.(e as never);
  };
  // react-aria useSelectableCollection autoFocus mount effect (retried until the grid has items).
  if (autoFocus !== undefined)
    clientEffect(() => {
      const el = gridEl();
      version();
      if (!el || !read(autoFocus)) return;
      untrack(() => {
        const v = view();
        gridListAutoFocus({ ...eventOptions(v, el), ref: el }, v);
      });
    });
  const gridDescription = (
    <Show when={() => highlight() != null}>
      {() => (
        <div id={descriptionId} hidden>
          {highlight()}
        </div>
      )}
    </Show>
  );
  if (props.render) {
    const attrs = {
      ...dom,
      ref: rootRef as never,
      id: state.id,
      role: "grid",
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-label": () => gridAttrs()["aria-label"] as string | undefined,
      "aria-labelledby": () => gridAttrs()["aria-labelledby"] as string | undefined,
      "aria-describedby": () => gridAttrs()["aria-describedby"] as string | undefined,
      "aria-details": () => gridAttrs()["aria-details"] as string | undefined,
      "aria-multiselectable": () => gridAttrs()["aria-multiselectable"] as "true" | undefined,
      "aria-rowcount": () => gridAttrs()["aria-rowcount"] as number | undefined,
      "aria-colcount": () => gridAttrs()["aria-colcount"] as number | undefined,
      tabindex: () => gridAttrs().tabIndex as number,
      "data-empty": () => dataBool(isEmpty()),
      "data-layout": layout,
      "data-orientation": orientation,
      onKeyDownCapture: (e: KeyboardEvent) => {
        const v = view();
        gridListKeyDownCapture(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
      },
      onKeyDown: (e: KeyboardEvent) => {
        const v = view();
        gridListKeyDown(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
      },
      onFocusIn: (e: FocusEvent) => {
        const v = view();
        gridListFocus(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
        onFocusInCtx?.(e as never);
      },
      onFocusOut: (e: FocusEvent) => {
        const v = view();
        gridListBlur(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
      },
      onMouseDown: (e: MouseEvent) => {
        const v = view();
        gridListMouseDown(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
        onMouseDown?.(e as never);
      },
      onFocus: (e: FocusEvent) => focusStateFocus(ring, e as never),
      onBlur: (e: FocusEvent) => focusStateBlur(ring, e as never),
      onScroll: (e: Event) => scrolled(e),
      children: () => [
        <Provider
          values={[
            [GridListInternalContext, internal],
            [SharedElementContext, sharedElements],
          ]}
        >
          {
            (customRenderer ?? DefaultCollectionRenderer).CollectionRoot({
              collection: rootCollection,
              content,
              idScope,
              scrollRef: gridEl,
              focusedKey,
            }) as never
          }
        </Provider>,
        <Show when={isEmpty}>
          {() =>
            renderEmptyState ? (
              <div role="row" aria-rowindex={1} style={{ display: "contents" }}>
                <div role="gridcell" style={{ display: "contents" }}>
                  {renderEmptyState(values) as never}
                </div>
              </div>
            ) : null
          }
        </Show>,
      ],
    };
    return (
      <>
        {props.render(attrs as never, values)}
        {gridDescription}
      </>
    );
  }
  return (
    <>
      <div
        {...dom}
        ref={rootRef as never}
        id={state.id}
        role="grid"
        slot={slot}
        class={rp.class()}
        style={rp.style()}
        aria-label={gridAttrs()["aria-label"] as string | undefined}
        aria-labelledby={gridAttrs()["aria-labelledby"] as string | undefined}
        aria-describedby={gridAttrs()["aria-describedby"] as string | undefined}
        aria-details={gridAttrs()["aria-details"] as string | undefined}
        aria-multiselectable={gridAttrs()["aria-multiselectable"] as "true" | undefined}
        aria-rowcount={gridAttrs()["aria-rowcount"] as number | undefined}
        aria-colcount={gridAttrs()["aria-colcount"] as number | undefined}
        tabIndex={gridAttrs().tabIndex as number}
        data-empty={dataBool(isEmpty())}
        data-layout={layout}
        data-orientation={orientation}
        onKeyDownCapture={(e) => {
          const v = view();
          gridListKeyDownCapture(e, eventOptions(v, e.currentTarget as HTMLElement), v);
        }}
        onKeyDown={(e) => {
          const v = view();
          gridListKeyDown(e, eventOptions(v, e.currentTarget as HTMLElement), v);
        }}
        onFocusIn={(e) => {
          const v = view();
          gridListFocus(e, eventOptions(v, e.currentTarget as HTMLElement), v);
          onFocusInCtx?.(e);
        }}
        onFocusOut={(e) => {
          const v = view();
          gridListBlur(e, eventOptions(v, e.currentTarget as HTMLElement), v);
        }}
        onMouseDown={(e) => {
          const v = view();
          gridListMouseDown(e, eventOptions(v, e.currentTarget as HTMLElement), v);
          onMouseDown?.(e as never);
        }}
        onFocus={(e) => focusStateFocus(ring, e)}
        onBlur={(e) => focusStateBlur(ring, e)}
        onScroll={virtualScroll || onScroll ? scrolled : undefined}
      >
        <Provider
          values={[
            [GridListInternalContext, internal],
            // RAC: the items share one SharedElementTransition scope (a SelectionIndicator animates between them).
            [SharedElementContext, sharedElements],
          ]}
        >
          {
            (customRenderer ?? DefaultCollectionRenderer).CollectionRoot({
              collection: rootCollection,
              content,
              idScope,
              scrollRef: gridEl,
              focusedKey,
            }) as never
          }
        </Provider>
        <Show when={isEmpty}>
          {() =>
            renderEmptyState ? (
              <div role="row" aria-rowindex={1} style={{ display: "contents" }}>
                <div role="gridcell" style={{ display: "contents" }}>
                  {renderEmptyState(values) as never}
                </div>
              </div>
            ) : null
          }
        </Show>
      </div>
      <Show when={() => highlight() != null}>
        {() => (
          <div id={descriptionId} hidden>
            {highlight()}
          </div>
        )}
      </Show>
    </>
  );
}

// --- GridListItem --------------------------------------------------------------------------------

/** RAC `GridListItemRenderProps` (accessors: call them inside bindings). */
export interface GridListItemRenderProps {
  /** The unique id of the item. */
  id: Key;
  /** @selector [data-hovered] */
  isHovered: () => boolean;
  /** @selector [data-pressed] */
  isPressed: () => boolean;
  /** @selector [data-selected] */
  isSelected: () => boolean;
  /** @selector [data-focused] */
  isFocused: () => boolean;
  /** @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the item's children have keyboard focus. @selector [data-focus-visible-within] */
  isFocusVisibleWithin: () => boolean;
  /** @selector [data-disabled] */
  isDisabled: () => boolean;
  /** @selector [data-selection-mode="single | multiple"] */
  selectionMode: SelectionMode;
  selectionBehavior: () => SelectionBehavior;
  /** @selector [data-allows-dragging] */
  allowsDragging: boolean;
  /** @selector [data-dragging] */
  isDragging: () => boolean;
  /** @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** State of the grid list. */
  state: ListState;
}

export interface GridListItemProps<T = object>
  extends
    RenderProps<GridListItemRenderProps>,
    DOMRenderProps<"div", GridListItemRenderProps>,
    LinkDOMProps,
    HoverEvents,
    PressEvents,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style"> {
  /** The unique id of the item. */
  id?: Key;
  /** The object value that this item represents. When using dynamic collections, this is set automatically. */
  value?: T;
  /** A string representation of the item's contents, used for features like typeahead. */
  textValue?: string;
  "aria-label"?: string;
  /** Whether the item is disabled. */
  isDisabled?: boolean;
  /** Handler that is called when a user performs an action on the item. */
  onAction?: () => void;
  /** Whether the row or its first focusable child element should be focused when navigating to the row. Default "row". */
  focusMode?: "child" | "row";
  /** Whether the row supports arrow key navigation even when the collection uses tab keyboard navigation. */
  allowsArrowNavigation?: boolean;
  ref?: RefValue<HTMLDivElement>;
}

const ROW_OWNED = ["onPointerDown", "onPointerUp", "onPointerCancel", "onClick", "onDblClick", "onPointerEnter", "onPointerLeave", "style", "id"] as const;
/** A GridListItem represents an individual item in a GridList (RAC `GridListItem`). */
export const GridListItem = /*#__PURE__*/ createLeafComponent(
  ItemNode,
  function GridListItem(props: GridListItemProps<any>, forwardedRef: unknown, item: Node<any>) {
    const ctx = useContext(GridListInternalContext);
    if (!ctx) throw new Error("GridListItem must be rendered inside a GridList.");
    const { state, shared, locale, direction, keyboardNavigationBehavior, isVirtualized } = ctx;
    const built = ctx.collection;
    const key = item.key;
    const spec = rowSpec(key, item, props as Record<string, any>);
    // Live `isDisabled` (LIVE-SWEEP round 2): the row's spec with the current value (read in the computed / at event time).
    const disabledView = isLive(props, "isDisabled") ? liveView(props, ["isDisabled"]) : undefined;
    const specNow = (): RowSpec => (disabledView ? withDisabled(spec, !!read(disabledView.isDisabled as MaybeAccessor<boolean | undefined>)) : spec);
    const descriptionSlot = createSlotId();
    const checkboxId = createId();
    const router = useRouter();
    // Resumable closures / bags read locals only (a `props.x` read captures the whole props object).
    const { focusMode, allowsArrowNavigation, onHoverStart, onHoverEnd, onHoverChange } = props;
    const itemOptions = (node: Node<unknown>): AriaGridListItemOptions => ({
      node,
      isVirtualized,
      focusMode,
      allowsArrowNavigation,
      descriptionId: slotRef(descriptionSlot),
      router,
      locale,
      direction,
    });
    const aria = computed(() => {
      const collection = rowCollection(specNow());
      const node = collection.getItem(key)!;
      const v: GridListStateLike<unknown> = {
        collection,
        selectionManager: listSelectionManager(state, collection),
        disabledKeys: state.disabledKeys,
        list: shared,
      };
      const result = gridListItemProps(itemOptions(node), v);
      // RA useGridListItem (virtualized): the row's index in the whole collection (the one-node collection's is 1).
      if (isVirtualized && built) result.rowProps["aria-rowindex"] = gridListRowIndex(built(), key);
      const checkbox = gridListSelectionCheckboxProps({ key, locale, id: checkboxId }, v).checkboxProps;
      return {
        ...result,
        checkbox,
        selectionMode: v.selectionManager.selectionMode,
        selectionBehavior: v.selectionManager.selectionBehavior,
        disabledBehavior: v.selectionManager.disabledBehavior,
      };
    });
    const view = () => listStateView(state, shared);
    // Resumable: a local const arrow called from the inline JSX handlers (no factory-made closures).
    const fire = <E extends Event>(handler: (e: E, o: AriaGridListItemOptions, v: GridListStateLike<any>) => void, e: E) => {
      const v = view();
      handler(e, itemOptions(eventNode(v, specNow())), v);
    };

    const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
    const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
    const pressed: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
    const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
    const focusVisibleWithin: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
    const hover: InteractionStateOptions = {
      // WebKit bug 214609: hover only when the row is selectable / actionable (or draggable).
      isDisabled: () => !aria().allowsSelection && !aria().hasAction,
      onHoverStart,
      onHoverEnd,
      onHoverChange,
      states: wantsStates ? { isHovered: hovered } : undefined,
    };
    // RA usePress state (not reactive in selectable-item): mirror it on the row after press events.
    const syncPressed = (e: Event) => {
      const el = e.currentTarget as HTMLElement;
      const v = view();
      const isPressed = gridListItemProps({ ...itemOptions(eventNode(v, specNow())), ref: el }, v).isPressed;
      setDataAttr(el, "data-pressed", isPressed);
      pressed?.set(isPressed);
    };
    const values: GridListItemRenderProps = {
      id: key,
      isHovered: () => !!hovered?.(),
      isPressed: () => !!pressed?.(),
      isSelected: () => aria().isSelected,
      isFocused: () => aria().isFocused,
      isFocusVisible: () => !!focusVisible?.(),
      isFocusVisibleWithin: () => !!focusVisibleWithin?.(),
      isDisabled: () => aria().isDisabled,
      selectionMode: untrack(() => aria().selectionMode),
      selectionBehavior: () => aria().selectionBehavior,
      allowsDragging: false,
      isDragging: () => false,
      isDropTarget: () => false,
      state,
    };
    const rp = untrack(() =>
      resolveRenderProps(
        { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-GridListItem" },
        hasLive(props) ? (liveRenderProps(props) as never) : undefined,
      ),
    );
    const row = (name: string) => aria().rowProps[name] as never;
    const dom = globalDOMProps(props, ROW_OWNED);
    const { onPointerDown, onPointerUp, onPointerCancel, onDblClick, onPointerEnter, onPointerLeave } = props as Record<string, any>;
    const arrowCapture = keyboardNavigationBehavior === "arrow" || !!allowsArrowNavigation;
    // RA useGridListSelectionCheckbox: the "selection" slot of CheckboxContext / CheckboxFieldContext.
    const checkboxProps = {
      id: checkboxId,
      "aria-label": untrack(() => aria().checkbox["aria-label"]),
      "aria-labelledby": untrack(() => aria().checkbox["aria-labelledby"]),
      isSelected: () => aria().isSelected,
      isDisabled: () => aria().checkbox.isDisabled,
      onChange: (isSelected: boolean) => gridListSelectionCheckboxChange(isSelected, { key, locale }, view()),
    };
    // RAC `{isDisabled: true}` when disabledBehavior "all" + disabled row, as an accessor: a tracked read in the Provider
    // values would re-create the row content (and replace a pressed Button) on every focus / selection change.
    const buttonProps = { isDisabled: () => aria().disabledBehavior === "all" && aria().isDisabled };
    const renderRow = () => {
      if (props.render) {
        const attrs = {
          ...dom,
          ref: forwardedRef as never,
          id: () => row("id"),
          role: "row",
          class: () => rp.class(),
          style: () => rp.style(),
          "data-key": () => row("data-key"),
          "data-key-type": () => row("data-key-type"),
          "data-collection": state.id,
          "data-text-value": item.textValue || undefined,
          tabindex: () => row("tabIndex"),
          "aria-label": () => row("aria-label"),
          "aria-labelledby": () => row("aria-labelledby"),
          "aria-selected": () => (row("aria-selected") === undefined ? undefined : String(row("aria-selected"))),
          "aria-disabled": () => (row("aria-disabled") ? "true" : undefined),
          "aria-rowindex": () => row("aria-rowindex"),
          "data-href": () => row("data-href"),
          "data-target": () => row("data-target"),
          "data-rel": () => row("data-rel"),
          "data-download": () => row("data-download"),
          "data-ping": () => row("data-ping"),
          "data-referrer-policy": () => row("data-referrer-policy"),
          "data-selected": () => dataBool(aria().isSelected),
          "data-disabled": () => dataBool(aria().isDisabled),
          "data-focused": () => dataBool(aria().isFocused),
          "data-selection-mode": () => (aria().selectionMode === "none" ? undefined : aria().selectionMode),
          onKeyDownCapture: (e: KeyboardEvent) => {
            if (arrowCapture) fire(gridListItemKeyDownCapture, e);
          },
          onKeyDown: (e: KeyboardEvent) => {
            fire(gridListItemKeyDown, e);
            syncPressed(e);
          },
          onKeyUp: (e: KeyboardEvent) => {
            fire(gridListItemKeyUp, e);
            syncPressed(e);
          },
          onFocusIn: (e: FocusEvent) => {
            fire(gridListItemFocus, e);
            const el = e.currentTarget as Element;
            focusRingFocus(ringOf(el, true, "data-focus-visible-within", focusVisibleWithin), e);
          },
          onFocusOut: (e: FocusEvent) => focusRingBlur(ringOf(e.currentTarget as Element, true, "data-focus-visible-within", focusVisibleWithin), e),
          onFocus: (e: FocusEvent) => focusRingFocus(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e),
          onBlur: (e: FocusEvent) => focusRingBlur(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e),
          onPointerDown: (e: PointerEvent) => {
            fire(gridListItemPointerDown, e);
            syncPressed(e);
            onPointerDown?.(e);
          },
          onPointerUp: (e: PointerEvent) => {
            fire(gridListItemPointerUp, e);
            syncPressed(e);
            onPointerUp?.(e);
          },
          onPointerCancel: (e: PointerEvent) => {
            fire(gridListItemPointerCancel, e);
            syncPressed(e);
            onPointerCancel?.(e);
          },
          onClick: (e: MouseEvent) => {
            fire(gridListItemClick, e);
            syncPressed(e);
          },
          onDblClick: (e: MouseEvent) => {
            fire(gridListItemDoubleClick, e);
            onDblClick?.(e);
          },
          onDragStart: (e: DragEvent) => fire(gridListItemDragStart, e),
          onPointerEnter: (e: PointerEvent) => {
            hoverStateEnter(hover, e);
            onPointerEnter?.(e);
          },
          onPointerLeave: (e: PointerEvent) => {
            hoverStateLeave(hover, e);
            onPointerLeave?.(e);
          },
          children: () => (
            <div role="gridcell" aria-colindex={1} style={{ display: "contents" }}>
              <Provider
                values={[
                  [CheckboxContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
                  [CheckboxFieldContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
                  [ButtonContext, { slots: { [DEFAULT_SLOT]: buttonProps } }],
                  [TextContext, { slots: { [DEFAULT_SLOT]: {}, description: { id: descriptionSlot } } }],
                  [CollectionRendererContext, DefaultCollectionRenderer],
                  [GridListInternalContext, null],
                  [SelectionIndicatorContext, { isSelected: () => aria().isSelected }],
                ]}
              >
                {rp.children() as never}
              </Provider>
            </div>
          ),
        };
        return props.render(attrs as never, values);
      }
      return (
        <div
          {...dom}
          ref={forwardedRef as never}
          id={row("id")}
          role="row"
          class={rp.class()}
          style={rp.style()}
          data-key={row("data-key")}
          data-key-type={row("data-key-type")}
          data-collection={state.id}
          data-text-value={item.textValue || undefined}
          tabIndex={row("tabIndex")}
          aria-label={row("aria-label")}
          aria-labelledby={row("aria-labelledby")}
          aria-selected={row("aria-selected") === undefined ? undefined : String(row("aria-selected"))}
          aria-disabled={row("aria-disabled") ? "true" : undefined}
          aria-rowindex={row("aria-rowindex")}
          data-href={row("data-href")}
          data-target={row("data-target")}
          data-rel={row("data-rel")}
          data-download={row("data-download")}
          data-ping={row("data-ping")}
          data-referrer-policy={row("data-referrer-policy")}
          data-selected={dataBool(aria().isSelected)}
          data-disabled={dataBool(aria().isDisabled)}
          data-focused={dataBool(aria().isFocused)}
          data-selection-mode={aria().selectionMode === "none" ? undefined : aria().selectionMode}
          onKeyDownCapture={arrowCapture ? (e: KeyboardEvent) => fire(gridListItemKeyDownCapture, e) : undefined}
          onKeyDown={(e) => {
            fire(gridListItemKeyDown, e);
            syncPressed(e);
          }}
          onKeyUp={(e) => {
            fire(gridListItemKeyUp, e);
            syncPressed(e);
          }}
          onFocusIn={(e) => {
            fire(gridListItemFocus, e);
            const el = e.currentTarget as Element;
            focusRingFocus(ringOf(el, true, "data-focus-visible-within", focusVisibleWithin), e);
          }}
          onFocusOut={(e) => focusRingBlur(ringOf(e.currentTarget as Element, true, "data-focus-visible-within", focusVisibleWithin), e)}
          onFocus={(e) => focusRingFocus(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e)}
          onBlur={(e) => focusRingBlur(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e)}
          onPointerDown={(e) => {
            fire(gridListItemPointerDown, e);
            syncPressed(e);
            onPointerDown?.(e);
          }}
          onPointerUp={(e) => {
            fire(gridListItemPointerUp, e);
            syncPressed(e);
            onPointerUp?.(e);
          }}
          onPointerCancel={(e) => {
            fire(gridListItemPointerCancel, e);
            syncPressed(e);
            onPointerCancel?.(e);
          }}
          onClick={(e) => {
            fire(gridListItemClick, e);
            syncPressed(e);
          }}
          onDblClick={(e) => {
            fire(gridListItemDoubleClick, e);
            onDblClick?.(e);
          }}
          onDragStart={(e) => fire(gridListItemDragStart, e)}
          onPointerEnter={(e) => {
            hoverStateEnter(hover, e);
            onPointerEnter?.(e);
          }}
          onPointerLeave={(e) => {
            hoverStateLeave(hover, e);
            onPointerLeave?.(e);
          }}
        >
          <div role="gridcell" aria-colindex={1} style={{ display: "contents" }}>
            <Provider
              values={[
                [CheckboxContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
                [CheckboxFieldContext, { slots: { [DEFAULT_SLOT]: {}, selection: checkboxProps } }],
                [ButtonContext, { slots: { [DEFAULT_SLOT]: buttonProps } }],
                [TextContext, { slots: { [DEFAULT_SLOT]: {}, description: { id: descriptionSlot } } }],
                [CollectionRendererContext, DefaultCollectionRenderer],
                [GridListInternalContext, null],
                [SelectionIndicatorContext, { isSelected: () => aria().isSelected }],
              ]}
            >
              {rp.children() as never}
            </Provider>
          </div>
        </div>
      );
    };
    const filter = ctx.filter;
    if (!filter) return renderRow();
    // Autocomplete filtering (live mode: per row; RAC UNSTABLE_useFilteredListState).
    const visible = () => filter(spec.textValue ?? "", rowCollection(spec).getItem(key)!);
    // Server: render right away, inside the collection row's resume region (runtime gap: a function child renders after it closed).
    return <Show when={visible}>{typeof document === "undefined" ? (visible() ? renderRow() : null) : renderRow}</Show>;
  },
) as <T>(props: GridListItemProps<T>) => unknown;

// --- GridListLoadMoreItem ------------------------------------------------------------------------

export interface GridListLoadMoreItemProps extends Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The CSS class of the element. @default "rv-GridListLoadingIndicator" */
  class?: string;
  style?: StyleObject;
  /** The load more spinner to render when loading additional items. */
  children?: unknown;
  /** Whether or not the loading spinner should be rendered or not (a value or an accessor). */
  isLoading?: MaybeAccessor<boolean | undefined>;
  /** Handler that is called when more items should be loaded, e.g. while scrolling near the bottom. */
  onLoadMore?: () => any;
  /** The amount of offset from the bottom of your scrollable region that should trigger load more (relative to the scroll body's client height). @default 1 */
  scrollOffset?: number;
}

/** A row shown while more items load + the sentinel that calls `onLoadMore` (RAC `GridListLoadMoreItem`). */
export const GridListLoadMoreItem = /*#__PURE__*/ createLeafComponent(LoaderNode, function GridListLoadingIndicator(props: GridListLoadMoreItemProps) {
  const ctx = useContext(GridListInternalContext);
  const { isLoading, onLoadMore, scrollOffset, children } = props;
  const sentinel = createRef<HTMLDivElement>();
  loadMoreSentinel({ collection: (ctx?.version ?? (() => null)) as never, onLoadMore, scrollOffset }, sentinel);
  const className = props.class ?? "rv-GridListLoadingIndicator";
  const style = props.style;
  const dom = globalDOMProps(props, ["style"]);
  const isVirtualized = !!ctx?.isVirtualized;
  return (
    <>
      {/* Always render the sentinel. The onus is on the user for styling with flex + gap. */}
      <div style={{ position: "relative", width: 0, height: 0 }} inert>
        <div data-testid="loadMoreSentinel" ref={sentinel} style={{ position: "absolute", height: "1px", width: "1px" }} />
      </div>
      <Show when={() => !!read(isLoading) && children != null}>
        {() => (
          <div {...dom} role="row" class={className} style={style}>
            <div aria-colindex={isVirtualized ? 1 : undefined} role="gridcell">
              {children as never}
            </div>
          </div>
        )}
      </Show>
    </>
  );
});

// --- GridListSection / GridListHeader ------------------------------------------------------------

export interface GridListSectionProps<T = object>
  extends CollectionProps<T>, DOMRenderProps<"div", undefined>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The unique id of the section. */
  id?: Key;
  /** The object value that this section represents. When using dynamic collections, this is set automatically. */
  value?: T;
  /** An accessibility label for the section. Required if no `GridListHeader` is present. */
  "aria-label"?: string;
  /** The CSS class of the element. @default "rv-GridListSection" */
  class?: string;
  style?: StyleObject;
  ref?: RefValue<HTMLDivElement>;
}

export interface GridListHeaderProps extends DOMRenderProps<"div", undefined>, Omit<GlobalDOMAttributes<HTMLElement>, "style"> {
  id?: string;
  class?: string;
  style?: StyleObject;
  children?: unknown;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `GridListHeaderContext`: the header row's props (role row) provided by the section. */
export const GridListHeaderContext = createContext<ContextValue<GridListHeaderProps, HTMLDivElement>>({});
/** RAC `GridListHeaderInnerContext`: the row header cell's props (`id`, role rowheader). */
export const GridListHeaderInnerContext = createContext<{ id?: string | SlotId; role?: string } | null>(null);

/** A GridListSection represents a section within a GridList (RAC `GridListSection`). */
export const GridListSection = /*#__PURE__*/ createBranchComponent(
  SectionNode,
  function GridListSection(props: GridListSectionProps<any>, forwardedRef: unknown, item: Node<any>) {
    const { CollectionBranch } = useContext(CollectionRendererContext);
    // The grid list's built collection (rows render from it); null outside a GridList (live content).
    const collection = (useContext(GridListInternalContext)?.collection ?? null) as CollectionInput;
    const heading = createSlotId();
    const ariaLabel = props["aria-label"];
    const aria = gridListSectionProps({ "aria-label": ariaLabel, headingId: heading.id });
    const labelledBy = () => (ariaLabel ? undefined : slotRef(heading));
    const dom = globalDOMProps(props, ["style", "id"]);
    const className = props.class ?? "rv-GridListSection";
    const style = props.style;
    if (props.render) {
      const attrs = {
        ...dom,
        ref: forwardedRef as never,
        role: aria.rowGroupProps.role as string,
        class: className,
        style,
        "data-type": "section",
        "data-key": String(item.key),
        "data-key-type": typeof item.key === "number" ? "number" : undefined,
        "aria-label": ariaLabel,
        "aria-labelledby": () => labelledBy(),
        children: () => (
          <Provider
            values={[
              [GridListHeaderContext, { ...aria.rowProps }],
              [GridListHeaderInnerContext, { ...aria.rowHeaderProps, id: heading }],
            ]}
          >
            {CollectionBranch({ collection, parent: item }) as never}
          </Provider>
        ),
      };
      return props.render(attrs as never, undefined);
    }
    return (
      <div
        {...dom}
        ref={forwardedRef as never}
        role={aria.rowGroupProps.role as string}
        class={className}
        style={style}
        data-type="section"
        data-key={String(item.key)}
        data-key-type={typeof item.key === "number" ? "number" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy()}
      >
        <Provider
          values={[
            [GridListHeaderContext, { ...aria.rowProps }],
            [GridListHeaderInnerContext, { ...aria.rowHeaderProps, id: heading }],
          ]}
        >
          {CollectionBranch({ collection, parent: item }) as never}
        </Provider>
      </div>
    );
  },
);

/** The header of a GridListSection (RAC `GridListHeader`). */
export const GridListHeader = /*#__PURE__*/ createLeafComponent(HeaderNode, function Header(inProps: GridListHeaderProps, forwardedRef: unknown) {
  const [props, ref] = contextProps(inProps, forwardedRef as RefValue<HTMLDivElement> | undefined, GridListHeaderContext) as [
    GridListHeaderProps & { role?: string },
    RefValue<HTMLDivElement> | undefined,
  ];
  const inner = useContext(GridListHeaderInnerContext);
  const innerId = inner?.id;
  if (isSlotId(innerId)) {
    innerId.rendered.set(true);
    onCleanup(() => innerId.rendered.set(false));
  }
  const { children, class: className, style, role, ...rest } = props as GridListHeaderProps & Record<string, unknown>;
  const dom = globalDOMProps(rest, ["style"]);
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        id: rest.id as string | undefined,
        role: role as string | undefined,
        class: className ?? "rv-GridListHeader",
        style: style as StyleObject | undefined,
        "data-type": "header",
        children: () => (
          <div id={isSlotId(innerId) ? innerId.id : innerId} role={inner?.role} style={{ display: "contents" }}>
            {children as never}
          </div>
        ),
      } as never,
      undefined,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      id={rest.id as string | undefined}
      role={role as string | undefined}
      class={className ?? "rv-GridListHeader"}
      style={style as StyleObject | undefined}
      data-type="header"
    >
      <div id={isSlotId(innerId) ? innerId.id : innerId} role={inner?.role} style={{ display: "contents" }}>
        {children as never}
      </div>
    </div>
  );
});
