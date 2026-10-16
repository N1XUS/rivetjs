// Ported from react-aria-components ListBox (packages/react-aria-components/src/ListBox.tsx), Apache-2.0, © Adobe.
// Parts: ListBox, ListBoxItem, ListBoxSection, ListBoxLoadMoreItem (+ Header / Text / Separator / Collection /
// SelectionIndicator inside); contexts ListBoxContext, ListStateContext.
// Rivet:
// - Collections run in live mode (`../collections/components.tsx`): options render in place and the listbox reads
//   its collection back from the rendered options at event time (no item model on resumed pages). A ListStateContext
//   from a parent (Select, ComboBox) whose state carries a built `collection` renders node by node instead
//   (`CollectionRoot({ collection })`), filtered by the SelectableCollectionContext `filter`.
// - One delegated handler set on the listbox element runs useSelectableList + every option's useSelectableItem /
//   useHover (`./behaviour.tsx`); option `data-hovered` / `data-pressed` are written by those handlers, root
//   `data-focused` / `data-focus-visible` bind to the ListData focus signals they set; option `data-selected` / `data-focused` / `data-focus-visible` / `data-disabled` bind
//   to the selection state. Option callbacks (`onAction`, `onHoverStart` / `onHoverEnd` / `onHoverChange`) are
//   attached to the option element only when given (`on:rv-item-action`, `on:rv-hover-start` / `-end`).
// - Render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`); `class` = RAC
//   `className`; default classes `rv-ListBox`, `rv-ListBoxItem`, `rv-ListBoxSection`, `rv-ListBoxLoadingIndicator`.
// - `items` preset: `<ListBox items={…} />` without children renders each item as a `ListBoxItem` (sections:
//   objects with a `children` array → `ListBoxSection` + `Header`).
// - Option label / description slot ids (useSlotId) are created only for non-text children (text children can hold
//   no `<Text slot>`: RA's effect would drop the ids anyway).
// - `isEmpty`: `items` length, else the built size of the children when `renderEmptyState` is given (a build pass),
//   else false; with a parent state, its collection size.
// `render` (RAC DOMRenderProps) on ListBox (`<div>`), ListBoxSection (`<section>`) and ListBoxItem (`<div>` / `<a>`): given, the attributes object goes to `render(attrs, renderProps)`
//   (custom events as `on<Type>` keys: `onRv-item-press`). Deviations: no drag and drop (`dragAndDropHooks`, drop indicators: C8); `ListBoxContext` is not re-provided to the
//   options (its value holds the JSX children: not serializable); no FocusScope; the SharedElementTransition scope is
//   a `SharedElementContext` provide;
//   live-mode filtering hides options but keeps empty sections.
import { createContext, provide, untrack, useContext } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { ItemNode, LoaderNode, SectionNode } from "../collections/base.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  SectionContext,
  buildCollectionFrom,
  createBranchComponent,
  createLeafComponent,
  isCollectionProbe,
  isHidden,
  resolveCollection,
  type CollectionInput,
  type SectionProps,
} from "../collections/components.tsx";
import { createListState, type ListProps, type ListState } from "../collections/list-state.ts";
import type { Collection as ICollection, Key, Node, Orientation, SelectionBehavior, SelectionMode } from "../collections/types.ts";
import { HeaderContext, Header } from "../header/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots } from "#server";
import { SeparatorContext } from "../separator/index.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { SharedElementContext, type SharedElementScope } from "../shared-element-transition/transition.tsx";
import { SelectableCollectionContext } from "../autocomplete/contexts.ts";
import {
  DEFAULT_SLOT,
  Provider,
  contextProps,
  mergeRefValues,
  mergedIdOf,
  createSlotId,
  renderProps as resolveRenderProps,
  resumableContext,
  slotIdRef,
} from "../slots/index.tsx";
import type { ContextValue, RefValue, RenderProps, SlotId, SlotProps, StyleObject, StyleRenderProps } from "../slots/index.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { hasLive, liveAssign, liveAt, liveKeys, liveView } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { createId } from "../utils/id.ts";
import { RouterContext } from "../utils/links.tsx";
import { loadMoreSentinel, type LoadMoreSentinelProps } from "../utils/load-more-sentinel.tsx";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import type { HoverEvents, PressEvents } from "../utils/types.ts";
import { keyboardKeyDown, keyboardKeyUp, type KeyboardEvents } from "../interactions/keyboard.tsx";
import {
  createListData,
  getItemId,
  listBoxAutoFocus,
  listBoxClearVirtualFocus,
  listBoxClick,
  listBoxDoubleClick,
  listBoxDragStart,
  listBoxFocusIn,
  listBoxFocusOut,
  listBoxKeyDown,
  listBoxKeyDownCapture,
  listBoxKeyUp,
  listBoxMouseDown,
  listBoxPointerCancel,
  listBoxPointerDown,
  listBoxPointerOut,
  listBoxPointerOver,
  listBoxPointerUp,
  listBoxProps,
  listBoxSectionProps,
  listBoxVirtualFocus,
  optionProps,
  type AriaListBoxOptions,
  type ListBoxBehaviourProps,
  type ListData,
} from "./behaviour.tsx";

export type { Key, Selection, SelectionMode, SelectionBehavior } from "../collections/types.ts";
export type { ListState } from "../collections/list-state.ts";
export { getItemId, type ListData } from "./behaviour.tsx";

/** Render props of `ListBox` (accessors; `@selector` = the matching attribute). */
export interface ListBoxRenderProps {
  /** Whether the listbox has no items and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
  /** Whether the listbox is currently focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the listbox is currently keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** Whether the listbox is currently the active drop target (always false: drag and drop is C8). @selector [data-drop-target] */
  isDropTarget: () => boolean;
  /** The layout of the listbox. @selector [data-layout="stack | grid"] */
  layout: "stack" | "grid";
  /** The primary orientation of the items. @selector [data-orientation="vertical | horizontal"] */
  orientation: Orientation;
  /** State of the listbox. */
  state: ListState;
}

export interface ListBoxProps<T = object>
  extends
    Omit<AriaListBoxOptions, "id" | "keyboardDelegate" | "isVirtualized" | "shouldUseVirtualFocus">,
    Omit<ListProps<T>, "items" | "children" | "collection" | "filter" | "suppressTextValueWarning" | "layoutDelegate" | "id">,
    StyleRenderProps<ListBoxRenderProps>,
    DOMRenderProps<"div", ListBoxRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onFocus" | "onBlur"> {
  /** Item objects in the collection (array or accessor). */
  items?: Iterable<T> | (() => Iterable<T>) | undefined;
  /** Static `ListBoxItem` / `ListBoxSection` children, or a renderer for `items`. Without children, `items` render as `ListBoxItem`s (Rivet `items` preset). */
  children?: unknown;
  /** RAC parity; ignored. */
  dependencies?: readonly unknown[] | undefined;
  /** Provides content to display when there are no items in the list. */
  renderEmptyState?: ((props: ListBoxRenderProps) => Content) | undefined;
  /** The element's id (also the option id prefix). */
  id?: string | undefined;
  ref?: RefValue<HTMLDivElement> | undefined;
  /** The CSS class of the element (a function of the render props). @default "rv-ListBox" */
  class?: StyleRenderProps<ListBoxRenderProps>["class"];
  style?: StyleRenderProps<ListBoxRenderProps>["style"];
}

/** RAC `ListBoxContext`: props for the ListBox inside a component (Select, ComboBox, Autocomplete…), optionally per slot. */
export const ListBoxContext = resumableContext(createContext<ContextValue<ListBoxProps<any>, HTMLDivElement>>(null, { id: "rv-listbox" }));
/** RAC `ListStateContext`: a parent's list state (Select, ComboBox); ListBox renders it instead of creating one. */
export const ListStateContext = resumableContext(createContext<ListState<any> | null>(null, { id: "rv-list-state" }));
/** Rivet: the listbox's shared option data (react-aria `listData`). */
export const ListBoxDataContext = resumableContext(createContext<ListData | null>(null, { id: "rv-listbox-data" }));

/** Global DOM events the listbox element handles itself; the user's run after its own. */
const OWNED = [
  "onKeyDown",
  "onKeyUp",
  "onPointerDown",
  "onPointerUp",
  "onPointerCancel",
  "onClick",
  "onDblClick",
  "onMouseDown",
  "onPointerOver",
  "onPointerOut",
  "onFocusIn",
  "onFocusOut",
  "onDragStart",
  "style",
] as const;

/** Rivet `items` preset: an item object → `ListBoxItem` (sections: `{ children: [...] }` → `ListBoxSection`). */
function presetItem(item: any): unknown {
  if (item && typeof item === "object" && Array.isArray(item.children)) {
    const title = item.title ?? item.name;
    return (
      <ListBoxSection id={item.id ?? item.key} aria-label={item["aria-label"]} items={item.children}>
        {title != null ? <Header>{title}</Header> : null}
        <Collection items={item.children}>{presetItem}</Collection>
      </ListBoxSection>
    );
  }
  const label = item?.label ?? item?.name ?? item?.textValue ?? String(item);
  return (
    <ListBoxItem
      id={item?.id ?? item?.key}
      textValue={item?.textValue ?? (typeof label === "string" ? label : undefined)}
      isDisabled={item?.isDisabled ?? item?.disabled}
      href={item?.href}
      aria-label={item?.["aria-label"]}
    >
      {label}
    </ListBoxItem>
  );
}

/** A listbox displays a list of options and allows a user to select one or more of them (RAC `ListBox`). */
export function ListBox<T = object>(inProps: ListBoxProps<T>) {
  const [props, ref] = contextProps(inProps, inProps.ref, ListBoxContext) as [ListBoxProps<T>, RefValue<HTMLDivElement> | undefined];
  const state = useContext(ListStateContext);
  if (state) return <ListBoxInner state={state} props={props} listBoxRef={ref} />;
  const children = props.children === undefined && props.items != null ? presetItem : props.children;
  // Inside a parent's build pass (closed Select / ComboBox popover): register the items only.
  if (isHidden()) {
    // Autocomplete's server id probe: merge the own id into the collection id (as ListBoxInner does), register nothing.
    if (isCollectionProbe())
      return (void contextProps(props as ListBoxProps<T> & Record<string, unknown>, undefined, SelectableCollectionContext as never), null);
    return Collection({ items: props.items as Iterable<unknown>, children, dependencies: props.dependencies });
  }
  return <StandaloneListBox props={props} listBoxRef={ref} children={children} />;
}

function StandaloneListBox<T>(input: { props: ListBoxProps<T>; listBoxRef: RefValue<HTMLDivElement> | undefined; children: unknown }) {
  const { props, listBoxRef, children } = input;
  const layoutDelegate = useContext(CollectionRendererContext).layoutDelegate;
  // Live props: a controlled `selectedKeys={keys()}` stays live (accessor; never written); the copy reads no
  // `selectedKeys` getter (a resumed region is not re-created on a change).
  const selectedKeys = liveKeys(props, "selectedKeys");
  const own = selectedKeys !== untrack(() => props.selectedKeys) ? liveAssign(props, { selectedKeys }) : props;
  const state = createListState<T>({
    ...(own as ListProps<T>),
    // RAC ListBoxInner merges SelectableCollectionContext (Autocomplete) into the props useListBox reads the id
    // from (mergeIds: the listbox's own id wins), so without an own id the list takes the collection id.
    id: props.id ?? mergedIdOf((useContext(SelectableCollectionContext) as { id?: unknown } | null)?.id) ?? createId(),
    items: undefined,
    children: undefined,
    collection: undefined,
    layoutDelegate,
  });
  const items = props.items;
  const dependencies = props.dependencies;
  const content = () => Collection({ items: items as Iterable<unknown>, children, dependencies });
  // isEmpty: the items' length, or (with an empty state to show) the size of a built collection of the children.
  const empty = props.renderEmptyState;
  // Static children do not change: their emptiness is computed once (a build pass, only with an empty state).
  const staticEmpty =
    items != null ? false : empty && children != null ? untrack(() => buildCollectionFrom(() => Collection({ children })).size === 0) : children == null;
  const isEmpty = () => (items != null ? isEmptyIterable(typeof items === "function" ? (items as () => Iterable<T>)() : items) : staticEmpty);
  return <ListBoxInner state={state} props={own} listBoxRef={listBoxRef} content={content} isEmpty={isEmpty} />;
}

/** Rivet: keys the listbox handles (`data-rk`): the resume loader holds them, so a cold key never scrolls the page. */
const listBoxNavigationKeys = (layout: string, orientation: string): string =>
  "ArrowDown ArrowUp Home End PageUp PageDown Space Enter" + (orientation === "horizontal" || layout === "grid" ? " ArrowLeft ArrowRight" : "");

const isEmptyIterable = (items: Iterable<unknown>): boolean => {
  if (Array.isArray(items)) return items.length === 0;
  for (const _ of items) return false;
  return true;
};

interface ListBoxInnerInput<T> {
  state: ListState<T>;
  props: ListBoxProps<T>;
  listBoxRef: RefValue<HTMLDivElement> | undefined;
  /** Live mode: the collection content. */
  content?: () => unknown;
  isEmpty?: () => boolean;
}

function ListBoxInner<T>(input: ListBoxInnerInput<T>) {
  const { state, content } = input;
  // RAC: SelectableCollectionContext (Autocomplete) merges under the listbox props.
  const [merged, mergedRef] = contextProps(
    input.props as ListBoxProps<T> & Record<string, unknown>,
    input.listBoxRef,
    SelectableCollectionContext as never,
  ) as [
    ListBoxProps<T> & {
      filter?: (textValue: string, node: Node<unknown>) => boolean;
      shouldUseVirtualFocus?: MaybeAccessor<boolean | undefined>;
      onFocusIn?: (e: FocusEvent) => void;
    },
    RefValue<HTMLDivElement> | undefined,
  ];
  const props = merged;
  const layout = props.layout || "stack",
    orientation = props.orientation || "vertical";
  const filter = props.filter;
  // RAC mergeIds: the ListBox's own id wins over the parent's (ComboBox listbox / Autocomplete collection id).
  const id = (props.id as string | undefined) || state.id;
  const data = createListData(props, id, state.collection ? undefined : filter, useContext(RouterContext));
  // A parent's built collection (filtered like RAC UNSTABLE_useFilteredListState); live mode: none.
  const provided = state.collection;
  const builtCollection = (): ICollection<Node<unknown>> => {
    const c = resolveCollection(provided as CollectionInput)!;
    return filter && c.filter ? c.filter(filter) : c;
  };
  const collection: (() => ICollection<Node<unknown>>) | null = provided ? builtCollection : null;
  const liveEmpty = input.isEmpty;
  const isEmpty = () => (liveEmpty ? liveEmpty() : provided ? builtCollection().size === 0 : false);
  const behaviour: ListBoxBehaviourProps = {
    data,
    collection,
    autoFocus: props.autoFocus,
    shouldFocusWrap: props.shouldFocusWrap,
    escapeKeyBehavior: props.escapeKeyBehavior,
    disallowTypeAhead: props.disallowTypeAhead,
    shouldUseVirtualFocus: props.shouldUseVirtualFocus,
    orientation,
    layout,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    onFocusChange: props.onFocusChange,
  };
  // mergeIds: a parent's label self-reference (ComboBox `labelsProps(listBoxId, …)`) follows the merged id.
  // A host's accessor (Select: the menu is labelled by its Label only while one renders) is read in the binding.
  const labelledByProp = props["aria-labelledby"] as MaybeAccessor<string | undefined>;
  const labelledByAccessor = typeof labelledByProp === "function" ? labelledByProp : undefined;
  const labelledBy = typeof labelledByProp === "function" ? undefined : labelledByProp;
  const ariaLabelledBy =
    id !== state.id && labelledBy
      ? labelledBy
          .split(" ")
          .map((part) => (part === state.id ? id : part))
          .join(" ")
      : labelledBy;
  const aria = listBoxProps({ ...props, id, "aria-labelledby": ariaLabelledBy }, state, data).listBoxProps;
  const values: ListBoxRenderProps = {
    isEmpty,
    isFocused: () => data.isFocused(),
    isFocusVisible: () => data.isFocused() && data.focusVisible(),
    isDropTarget: () => false,
    layout,
    orientation,
    state,
  };
  const rp = untrack(() =>
    resolveRenderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-ListBox" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const {
    onKeyDown,
    onKeyUp,
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onClick,
    onDblClick,
    onMouseDown,
    onPointerOver,
    onPointerOut,
    onDragStart,
    onScroll,
  } = props as Record<string, ((e: any) => void) | undefined>;
  const onFocusIn = (props as Record<string, ((e: any) => void) | undefined>).onFocusIn;
  const onFocusOut = (props as Record<string, ((e: any) => void) | undefined>).onFocusOut;
  const dom = globalDOMProps(props, OWNED);
  const renderEmptyState = props.renderEmptyState;
  const slot = props.slot || undefined;
  const ariaLabel = aria["aria-label"] as string | undefined,
    ariaLabelledby = aria["aria-labelledby"] as string | undefined,
    ariaDescribedby = aria["aria-describedby"] as string | undefined,
    ariaDetails = aria["aria-details"] as string | undefined;
  const tabIndex = aria.tabIndex as () => number | undefined;
  const root = createRef<HTMLDivElement>();
  const userRef = mergedRef;
  if (read(props.autoFocus)) {
    clientEffect(() => {
      const el = root();
      if (el) untrack(() => listBoxAutoFocus(el, behaviour, state));
    });
  }
  const setRef = mergeRefValues(root as RefValue<HTMLDivElement>, userRef);
  const renderer = useContext(CollectionRendererContext);
  // Resumable (as GridList): the render path's lazy collection slot captures `customRenderer`, undefined for the default renderer.
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const sharedElements: SharedElementScope = {};
  if (props.render) {
    // The body is a compiled `<Provider>` binding (resumable, as Menu), not the eager `provide()` chain of the default
    // path: a render closure capturing that chain's result cannot be serialized.
    const renderBody = (
      <Provider
        values={[
          [ListStateContext, state],
          [ListBoxDataContext, data],
          [SeparatorContext, { elementType: "div" }],
          [SectionContext, { name: "ListBoxSection", render: ListBoxSectionInner }],
          [SharedElementContext, sharedElements],
        ]}
      >
        {(customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection, content, scrollRef: root }) as never}
      </Provider>
    );
    const attrs = {
      ...dom,
      ref: setRef,
      id,
      role: "listbox",
      slot,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-collection": id,
      "aria-label": ariaLabel,
      "aria-labelledby": () => (labelledByAccessor ? labelledByAccessor() : ariaLabelledby),
      "aria-describedby": ariaDescribedby,
      "aria-details": ariaDetails,
      "aria-orientation": orientation,
      "aria-multiselectable": state.selectionState.selectionMode === "multiple" ? "true" : undefined,
      tabindex: () => tabIndex(),
      "data-empty": () => dataBool(isEmpty()),
      "data-focused": () => dataBool(data.isFocused()),
      "data-focus-visible": () => dataBool(data.isFocused() && data.focusVisible()),
      "data-layout": layout,
      "data-orientation": orientation,
      "data-rk": listBoxNavigationKeys(layout, orientation),
      onKeyDownCapture: (e: KeyboardEvent) => listBoxKeyDownCapture(e, behaviour, state),
      onKeyDown: (e: KeyboardEvent) => {
        onKeyDown?.(e);
        listBoxKeyDown(e, behaviour, state);
      },
      onKeyUp: (e: KeyboardEvent) => {
        onKeyUp?.(e);
        listBoxKeyUp(e, behaviour, state);
      },
      onPointerDown: (e: PointerEvent) => {
        listBoxPointerDown(e, behaviour, state);
        onPointerDown?.(e);
      },
      onPointerUp: (e: PointerEvent) => {
        listBoxPointerUp(e, behaviour, state);
        onPointerUp?.(e);
      },
      onPointerCancel: (e: PointerEvent) => {
        listBoxPointerCancel(e, behaviour, state);
        onPointerCancel?.(e);
      },
      onClick: (e: MouseEvent) => {
        listBoxClick(e, behaviour, state);
        onClick?.(e);
      },
      onDblClick: (e: MouseEvent) => {
        listBoxDoubleClick(e, behaviour, state);
        onDblClick?.(e);
      },
      onMouseDown: (e: MouseEvent) => {
        listBoxMouseDown(e, behaviour, state);
        onMouseDown?.(e);
      },
      onPointerOver: (e: PointerEvent) => {
        listBoxPointerOver(e, behaviour, state);
        onPointerOver?.(e);
      },
      onPointerOut: (e: PointerEvent) => {
        listBoxPointerOut(e, behaviour, state);
        onPointerOut?.(e);
      },
      onFocusIn: (e: FocusEvent) => {
        listBoxFocusIn(e, behaviour, state);
        onFocusIn?.(e);
      },
      onFocusOut: (e: FocusEvent) => {
        listBoxFocusOut(e, behaviour, state);
        onFocusOut?.(e);
      },
      onDragStart: (e: DragEvent) => {
        listBoxDragStart(e, behaviour, state);
        onDragStart?.(e);
      },
      onScroll: (e: Event) => onScroll?.(e),
      // Custom events: the spread takes `on<Type>` keys (no `on:` form).
      "onReact-aria-focus": (e: Event) => listBoxVirtualFocusEvent(e, behaviour, state),
      "onReact-aria-clear-focus": (e: Event) => listBoxClearFocusEvent(e, behaviour, state),
      children: () => [
        renderBody,
        renderEmptyState ? (
          <Show when={isEmpty}>
            {() => (
              <div role="option" style={{ display: "contents" }}>
                {renderEmptyState(values) as never}
              </div>
            )}
          </Show>
        ) : null,
      ],
    };
    return props.render(attrs as never, values);
  }
  const body = provide(ListStateContext, state, () =>
    provide(ListBoxDataContext, data, () =>
      provide(SeparatorContext, { elementType: "div" } as never, () =>
        provide(SectionContext, { name: "ListBoxSection", render: ListBoxSectionInner as never }, () =>
          // RAC: the options share one SharedElementTransition scope (a SelectionIndicator animates between them).
          provide(SharedElementContext, sharedElements, () => renderer.CollectionRoot({ collection, content, scrollRef: root })),
        ),
      ),
    ),
  );
  return (
    <div
      {...dom}
      ref={setRef as never}
      id={id}
      role="listbox"
      preload="visible"
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      data-collection={id}
      aria-label={ariaLabel}
      aria-labelledby={labelledByAccessor ? labelledByAccessor() : ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-details={ariaDetails}
      aria-orientation={orientation}
      aria-multiselectable={state.selectionState.selectionMode === "multiple" ? "true" : undefined}
      tabIndex={tabIndex()}
      data-empty={dataBool(isEmpty())}
      data-focused={dataBool(data.isFocused())}
      data-focus-visible={dataBool(data.isFocused() && data.focusVisible())}
      data-layout={layout}
      data-orientation={orientation}
      data-rk={listBoxNavigationKeys(layout, orientation)}
      onKeyDownCapture={(e: KeyboardEvent) => listBoxKeyDownCapture(e, behaviour, state)}
      onKeyDown={(e: KeyboardEvent) => {
        onKeyDown?.(e);
        listBoxKeyDown(e, behaviour, state);
      }}
      onKeyUp={(e: KeyboardEvent) => {
        onKeyUp?.(e);
        listBoxKeyUp(e, behaviour, state);
      }}
      onPointerDown={(e: PointerEvent) => {
        listBoxPointerDown(e, behaviour, state);
        onPointerDown?.(e);
      }}
      onPointerUp={(e: PointerEvent) => {
        listBoxPointerUp(e, behaviour, state);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e: PointerEvent) => {
        listBoxPointerCancel(e, behaviour, state);
        onPointerCancel?.(e);
      }}
      onClick={(e: MouseEvent) => {
        listBoxClick(e, behaviour, state);
        onClick?.(e);
      }}
      onDblClick={(e: MouseEvent) => {
        listBoxDoubleClick(e, behaviour, state);
        onDblClick?.(e);
      }}
      onMouseDown={(e: MouseEvent) => {
        listBoxMouseDown(e, behaviour, state);
        onMouseDown?.(e);
      }}
      onPointerOver={(e: PointerEvent) => {
        listBoxPointerOver(e, behaviour, state);
        onPointerOver?.(e);
      }}
      onPointerOut={(e: PointerEvent) => {
        listBoxPointerOut(e, behaviour, state);
        onPointerOut?.(e);
      }}
      onFocusIn={(e: FocusEvent) => {
        listBoxFocusIn(e, behaviour, state);
        onFocusIn?.(e);
      }}
      onFocusOut={(e: FocusEvent) => {
        listBoxFocusOut(e, behaviour, state);
        onFocusOut?.(e);
      }}
      onDragStart={(e: DragEvent) => {
        listBoxDragStart(e, behaviour, state);
        onDragStart?.(e);
      }}
      onScroll={onScroll}
      on:react-aria-focus={(e: Event) => listBoxVirtualFocusEvent(e, behaviour, state)}
      on:react-aria-clear-focus={(e: Event) => listBoxClearFocusEvent(e, behaviour, state)}
    >
      {body as never}
      {renderEmptyState ? (
        <Show when={isEmpty}>
          {() => (
            <div role="option" style={{ display: "contents" }}>
              {renderEmptyState(values) as never}
            </div>
          )}
        </Show>
      ) : null}
    </div>
  );
}

const listBoxVirtualFocusEvent = (e: Event, b: ListBoxBehaviourProps, s: ListState) => listBoxVirtualFocus(e as never, b, s);
const listBoxClearFocusEvent = (e: Event, b: ListBoxBehaviourProps, s: ListState) => listBoxClearVirtualFocus(e as never, b, s);

// ---------------------------------------------------------------------------------------------
// ListBoxSection
// ---------------------------------------------------------------------------------------------

export interface ListBoxSectionProps<T = object>
  extends Omit<SectionProps<T>, `data-${string}`>, DOMRenderProps<"section", undefined>, GlobalDOMAttributes<HTMLElement> {
  /** @default "rv-ListBoxSection" */
  class?: string | undefined;
  style?: StyleObject | undefined;
  ref?: RefValue<HTMLElement> | undefined;
}

function ListBoxSectionInner<T>(props: ListBoxSectionProps<T>, ref: unknown, section: Node<T>, className = "rv-ListBoxSection") {
  const state = useContext(ListStateContext)!;
  const { CollectionBranch } = useContext(CollectionRendererContext);
  // RA useSlot: the heading id is kept while a Header consumes it. The children are built before the section's
  // attributes (below), so on the server a Header has already marked the id: `slotIdRef(heading, false)` writes
  // `aria-labelledby` only when the section has one (RAC's hydrated DOM; no IDREF to a missing element).
  const heading: SlotId = createSlotId();
  const { headingProps, groupProps } = listBoxSectionProps({ heading: heading.id, "aria-label": props["aria-label"] ?? undefined });
  const dom = globalDOMProps(props, ["style"]);
  const cls = props.class ?? className;
  const style = props.style;
  const label = groupProps["aria-label"] as string | undefined;
  const collection = state.collection ? (state.collection as CollectionInput) : null;
  const children = provide(HeaderContext, { ...headingProps, id: heading } as never, () => CollectionBranch({ collection, parent: section as Node<unknown> }));
  if (props.render) {
    const attrs = {
      ...dom,
      ref,
      class: cls,
      style,
      role: "group",
      "aria-label": label,
      "aria-labelledby": () => slotIdRef(heading, false),
      children: () => children,
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <section {...dom} ref={ref as never} class={cls} style={style} role="group" aria-label={label} aria-labelledby={slotIdRef(heading, false)}>
      {children as never}
    </section>
  );
}

/** A ListBoxSection represents a section within a ListBox (RAC `ListBoxSection`). */
export const ListBoxSection = /*#__PURE__*/ createBranchComponent(SectionNode, ListBoxSectionInner as never) as <T = object>(
  props: ListBoxSectionProps<T>,
) => unknown;

// ---------------------------------------------------------------------------------------------
// ListBoxItem
// ---------------------------------------------------------------------------------------------

/** Render props of `ListBoxItem` (RAC `ItemRenderProps`, accessors). */
export interface ListBoxItemRenderProps {
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
  /** @selector [data-disabled] */
  isDisabled: () => boolean;
  /** @selector [data-selection-mode="single | multiple"] */
  selectionMode: SelectionMode;
  /** The selection behavior for the collection. */
  selectionBehavior: () => SelectionBehavior;
  /** Drag and drop (C8): always false. @selector [data-allows-dragging] */
  allowsDragging: boolean;
  /** @selector [data-dragging] */
  isDragging: () => boolean;
  /** @selector [data-drop-target] */
  isDropTarget: () => boolean;
}

export interface ListBoxItemProps<T = object>
  extends
    RenderProps<ListBoxItemRenderProps>,
    DOMRenderProps<"div", ListBoxItemRenderProps>,
    HoverEvents,
    PressEvents,
    KeyboardEvents,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick"> {
  /** Click handler (RAC: chained into the option's press handling). */
  onClick?: ((e: MouseEvent) => void) | undefined;
  /** The unique id of the item. */
  id?: Key | undefined;
  /** The object value that this item represents (set automatically in dynamic collections). */
  value?: T | undefined;
  /** A string representation of the item's contents, used for features like typeahead. */
  textValue?: string | undefined;
  /** An accessibility label for this item. */
  "aria-label"?: string | undefined;
  /** Whether the item is disabled. */
  isDisabled?: boolean | undefined;
  /** Handler that is called when a user performs an action on the item. */
  onAction?: (() => void) | undefined;
  /** A URL to link to (renders an `<a>`). */
  href?: string | undefined;
  hrefLang?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  download?: boolean | string | undefined;
  ping?: string | undefined;
  referrerPolicy?: string | undefined;
  routerOptions?: Record<string, unknown> | undefined;
  ref?: RefValue<HTMLElement> | undefined;
}

/** A ListBoxItem represents an individual option in a ListBox (RAC `ListBoxItem`). */
export const ListBoxItem = /*#__PURE__*/ createLeafComponent(
  ItemNode,
  function ListBoxItem(props: ListBoxItemProps, forwardedRef: unknown, item: Node<unknown>) {
    const state = useContext(ListStateContext);
    const data = useContext(ListBoxDataContext);
    if (!state || !data) throw new Error("ListBoxItem must be rendered inside a ListBox.");
    const key = item.key;
    // Live props (P5): `isDisabled` / class / style / children stay live (node props forward unread); the rest is
    // read once (untracked body).
    const option = untrack(() => listBoxItem(props, forwardedRef, item, state, data));
    // Live-mode filtering (SelectableCollectionContext `filter`): the option hides itself. Tracked (outside the
    // untracked body): on the server the filter read belongs to the collection row's resume region.
    const filter = data.filter;
    if (filter) {
      const itemText = item.textValue,
        itemValue = item.value;
      const visible = () => filter(itemText, { key, type: "item", textValue: itemText, value: itemValue } as unknown as Node<unknown>);
      // Server: the option renders right away, inside the collection row's resume region (a function child runs
      // later, outside it: its bindings would outlive the row when filtering re-creates it; runtime gap).
      return <Show when={visible}>{typeof document === "undefined" ? (visible() ? option() : null) : option}</Show>;
    }
    return option();
  },
) as <T = object>(props: ListBoxItemProps<T>) => unknown;

/** `data-rv-disabled` of a live item `isDisabled` (a returned arrow: resumable). */
function rvDisabledAttr(isDisabled: () => boolean | undefined): () => "" | undefined {
  return () => (isDisabled() ? "" : undefined);
}

function listBoxItem(props: ListBoxItemProps, forwardedRef: unknown, item: Node<unknown>, state: ListState, data: ListData) {
  const key = item.key;
  const live = hasLive(props);
  const itemIsDisabled = live ? liveAt(liveView(props, ["isDisabled"]), "isDisabled") : props.isDisabled;
  const children = props.children;
  // useSlotId for the label / description Text slots (not for text children): kept while an element has the id.
  const plain = children == null || typeof children === "string" || typeof children === "number";
  const optionId = getItemId(data.id, key);
  const labelId: SlotId | undefined = plain ? undefined : createSlotId(optionId + "-label");
  const descriptionId: SlotId | undefined = plain ? undefined : createSlotId(optionId + "-description");
  const labelRef = (): string | undefined => slotIdRef(labelId, false);
  const descriptionRef = (): string | undefined => slotIdRef(descriptionId, false);
  const opt = optionProps(
    {
      key,
      itemIsDisabled,
      hasAction: !!props.onAction,
      "aria-label": props["aria-label"],
      labelId: labelRef,
      descriptionId: descriptionRef,
    },
    state,
    data,
  );
  const selectionMode = state.selectionState.selectionMode;
  const values: ListBoxItemRenderProps = {
    isHovered: opt.isHovered,
    isPressed: opt.isPressed,
    isSelected: opt.isSelected,
    isFocused: opt.isFocused,
    isFocusVisible: opt.isFocusVisible,
    isDisabled: opt.isDisabled,
    selectionMode,
    selectionBehavior: () => state.selectionState.selectionBehavior(),
    allowsDragging: false,
    isDragging: () => false,
    isDropTarget: () => false,
  };
  const rp = resolveRenderProps(
    { class: props.class, style: props.style, children, values, defaultClassName: "rv-ListBoxItem" },
    live ? (liveRenderProps(props) as never) : undefined,
  );
  const textSlots = labelId
    ? { slots: { [DEFAULT_SLOT]: { id: labelId }, label: { id: labelId }, description: { id: descriptionId } } }
    : { slots: { [DEFAULT_SLOT]: {}, label: {}, description: {} } };
  const content = () => provide(TextContext, textSlots as never, () => provide(SelectionIndicatorContext, { isSelected: opt.isSelected }, () => rp.children()));
  // Rivet (server): the option's attributes are written before its children: probe which label / description Text
  // parts render (`slotIdRef(id, false)` above; RA useSlotId drops the others after hydration). Same providers as `content`.
  if (typeof document === "undefined" && labelId)
    probeSlots(
      [
        [TextContext, textSlots],
        [SelectionIndicatorContext, { isSelected: opt.isSelected }],
      ],
      () => rp.children(),
    );
  const dom = globalDOMProps(props, ["onClick", "style"]);
  const id = optionId;
  const keyType = typeof key === "number" ? "number" : undefined;
  const ariaLabel = props["aria-label"];
  const textValue = props.textValue;
  const onAction = props.onAction;
  const { onHoverStart, onHoverEnd, onHoverChange, onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick } = props;
  const hasPress = !!(onPressStart || onPressEnd || onPressChange || onPress || onPressUp || onClick);
  const hasHover = !!(onHoverStart || onHoverEnd || onHoverChange);
  const href = props.href;
  const itemDisabled = typeof itemIsDisabled === "function" ? rvDisabledAttr(itemIsDisabled) : itemIsDisabled ? "" : undefined;
  // PROPS-CAPTURE: every prop the option closure reads is a local (reading `props` there captures the whole object).
  const { hrefLang, target, rel, download, onKeyDown: itemKeyDown, onKeyUp: itemKeyUp } = props;
  const optionAttrs = opt.optionProps;
  const labelledBy = optionAttrs["aria-labelledby"] as (() => string | undefined) | undefined;
  const describedBy = optionAttrs["aria-describedby"] as (() => string | undefined) | undefined;
  const ariaDisabled = optionAttrs["aria-disabled"] as () => string | undefined;
  const ariaSelected = optionAttrs["aria-selected"] as () => string | undefined;
  const tabIndex = optionAttrs.tabIndex as () => number | undefined;
  const ref = forwardedRef as never;
  // `ping` / `referrerpolicy` are missing from the anchor typings: spread.
  // `data-rv-disabled` (the item's own isDisabled, read by DOM collections) goes through the spread: an accessor when live.
  const linkDom: Record<string, unknown> = liveAssign(
    dom,
    href ? { ping: props.ping, referrerpolicy: props.referrerPolicy, "data-rv-disabled": itemDisabled } : { "data-rv-disabled": itemDisabled },
  );
  const option = () => {
    if (props.render) {
      const attrs = {
        ...linkDom,
        ref,
        id,
        role: "option",
        class: () => rp.class(),
        style: () => rp.style(),
        ...(href ? { href, hreflang: hrefLang, target, rel, download: download === true ? "" : download || undefined } : null),
        "data-key": String(key),
        "data-key-type": keyType,
        "data-collection": data.id,
        "data-text-value": textValue,
        "data-rv-action": onAction ? "" : undefined,
        "data-rv-press": hasPress ? "" : undefined,
        "aria-label": ariaLabel,
        "aria-labelledby": () => labelledBy?.(),
        "aria-describedby": () => describedBy?.(),
        "aria-disabled": () => ariaDisabled(),
        "aria-selected": () => ariaSelected(),
        tabindex: () => (href ? (tabIndex() ?? -1) : tabIndex()),
        "data-selected": () => dataBool(opt.isSelected()),
        "data-disabled": () => dataBool(opt.isDisabled()),
        "data-focused": () => dataBool(opt.isFocused()),
        "data-focus-visible": () => dataBool(opt.isFocusVisible()),
        "data-selection-mode": selectionMode === "none" ? undefined : selectionMode,
        onKeyDown: (e: KeyboardEvent) => itemKeyDown && keyboardKeyDown({ onKeyDown: itemKeyDown }, e),
        onKeyUp: (e: KeyboardEvent) => itemKeyUp && keyboardKeyUp({ onKeyUp: itemKeyUp }, e),
        // Custom events: the spread takes `on<Type>` keys (no `on:` form); the handlers no-op without their prop.
        "onRv-item-action": () => onAction?.(),
        "onRv-item-press": (e: CustomEvent) => itemPressEvent(e, onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick),
        "onRv-hover-start": (e: CustomEvent<{ pointerType: string }>) => hoverStart(e, onHoverStart, onHoverChange),
        "onRv-hover-end": (e: CustomEvent<{ pointerType: string }>) => hoverEnd(e, onHoverEnd, onHoverChange),
        children: () => content(),
      };
      return props.render(attrs as never, values);
    }
    return href ? (
      <a
        {...linkDom}
        ref={ref}
        id={id}
        role="option"
        class={rp.class()}
        style={rp.style()}
        href={href}
        hreflang={hrefLang}
        target={target}
        rel={rel}
        download={download === true ? "" : download || undefined}
        data-key={String(key)}
        data-key-type={keyType}
        data-collection={data.id}
        data-text-value={textValue}
        data-rv-action={onAction ? "" : undefined}
        data-rv-press={hasPress ? "" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy?.()}
        aria-describedby={describedBy?.()}
        aria-disabled={ariaDisabled()}
        aria-selected={ariaSelected()}
        tabIndex={tabIndex() ?? -1}
        data-selected={dataBool(opt.isSelected())}
        data-disabled={dataBool(opt.isDisabled())}
        data-focused={dataBool(opt.isFocused())}
        data-focus-visible={dataBool(opt.isFocusVisible())}
        data-selection-mode={selectionMode === "none" ? undefined : selectionMode}
        onKeyDown={itemKeyDown ? (e: KeyboardEvent) => keyboardKeyDown({ onKeyDown: itemKeyDown }, e) : undefined}
        onKeyUp={itemKeyUp ? (e: KeyboardEvent) => keyboardKeyUp({ onKeyUp: itemKeyUp }, e) : undefined}
        on:rv-item-action={onAction ? () => onAction() : undefined}
        on:rv-item-press={hasPress ? (e: CustomEvent) => itemPressEvent(e, onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick) : undefined}
        on:rv-hover-start={hasHover ? (e: CustomEvent<{ pointerType: string }>) => hoverStart(e, onHoverStart, onHoverChange) : undefined}
        on:rv-hover-end={hasHover ? (e: CustomEvent<{ pointerType: string }>) => hoverEnd(e, onHoverEnd, onHoverChange) : undefined}
      >
        {content() as never}
      </a>
    ) : (
      <div
        {...linkDom}
        ref={ref}
        id={id}
        role="option"
        class={rp.class()}
        style={rp.style()}
        data-key={String(key)}
        data-key-type={keyType}
        data-collection={data.id}
        data-text-value={textValue}
        data-rv-action={onAction ? "" : undefined}
        data-rv-press={hasPress ? "" : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy?.()}
        aria-describedby={describedBy?.()}
        aria-disabled={ariaDisabled()}
        aria-selected={ariaSelected()}
        tabIndex={tabIndex()}
        data-selected={dataBool(opt.isSelected())}
        data-disabled={dataBool(opt.isDisabled())}
        data-focused={dataBool(opt.isFocused())}
        data-focus-visible={dataBool(opt.isFocusVisible())}
        data-selection-mode={selectionMode === "none" ? undefined : selectionMode}
        onKeyDown={itemKeyDown ? (e: KeyboardEvent) => keyboardKeyDown({ onKeyDown: itemKeyDown }, e) : undefined}
        onKeyUp={itemKeyUp ? (e: KeyboardEvent) => keyboardKeyUp({ onKeyUp: itemKeyUp }, e) : undefined}
        on:rv-item-action={onAction ? () => onAction() : undefined}
        on:rv-item-press={hasPress ? (e: CustomEvent) => itemPressEvent(e, onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick) : undefined}
        on:rv-hover-start={hasHover ? (e: CustomEvent<{ pointerType: string }>) => hoverStart(e, onHoverStart, onHoverChange) : undefined}
        on:rv-hover-end={hasHover ? (e: CustomEvent<{ pointerType: string }>) => hoverEnd(e, onHoverEnd, onHoverChange) : undefined}
      >
        {content() as never}
      </div>
    );
  };
  return option;
}

/** RA useSelectableItem's collectionItemProps chaining: the option's press callbacks, from the delegated press. */
function itemPressEvent(
  e: CustomEvent,
  onPressStart: PressEvents["onPressStart"],
  onPressEnd: PressEvents["onPressEnd"],
  onPressChange: PressEvents["onPressChange"],
  onPress: PressEvents["onPress"],
  onPressUp: PressEvents["onPressUp"],
  onClick: ((e: MouseEvent) => void) | undefined,
): void {
  const ev = e.detail as { type: string; event?: MouseEvent };
  if (ev.type === "click") return onClick?.(ev.event!);
  if (ev.type === "pressstart") {
    onPressStart?.(ev as never);
    onPressChange?.(true);
  } else if (ev.type === "pressup") onPressUp?.(ev as never);
  else if (ev.type === "pressend") {
    onPressEnd?.(ev as never);
    onPressChange?.(false);
  } else if (ev.type === "press") onPress?.(ev as never);
}

function hoverStart(e: CustomEvent<{ pointerType: string }>, onHoverStart: HoverEvents["onHoverStart"], onHoverChange: HoverEvents["onHoverChange"]): void {
  onHoverStart?.({ type: "hoverstart", target: e.currentTarget as HTMLElement, pointerType: e.detail.pointerType as "mouse" | "pen" } as never);
  onHoverChange?.(true);
}

function hoverEnd(e: CustomEvent<{ pointerType: string }>, onHoverEnd: HoverEvents["onHoverEnd"], onHoverChange: HoverEvents["onHoverChange"]): void {
  onHoverEnd?.({ type: "hoverend", target: e.currentTarget as HTMLElement, pointerType: e.detail.pointerType as "mouse" | "pen" } as never);
  onHoverChange?.(false);
}

// ---------------------------------------------------------------------------------------------
// ListBoxLoadMoreItem
// ---------------------------------------------------------------------------------------------

export interface ListBoxLoadMoreItemProps extends Omit<LoadMoreSentinelProps, "collection" | "direction">, GlobalDOMAttributes<HTMLDivElement> {
  /** @default "rv-ListBoxLoadingIndicator" */
  class?: string | undefined;
  style?: StyleObject | undefined;
  /** The load more spinner to render when loading additional items. */
  children?: Content;
  /** Whether or not the loading spinner should be rendered or not (may be an accessor). */
  isLoading?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLDivElement> | undefined;
}

/** A sentinel that loads more items when scrolled into view, with an optional loading row (RAC `ListBoxLoadMoreItem`). */
export const ListBoxLoadMoreItem = /*#__PURE__*/ createLeafComponent(
  LoaderNode,
  function ListBoxLoadingIndicator(props: ListBoxLoadMoreItemProps, ref: unknown, _item: Node<unknown>) {
    const state = useContext(ListStateContext);
    const { isLoading, onLoadMore, scrollOffset } = props;
    const sentinel = createRef<HTMLDivElement>();
    // RAC passes `state.collection`; live mode: the sentinel re-arms when the loading state changes.
    const collection = state?.collection ? () => resolveCollection(state.collection as CollectionInput) : () => (read(isLoading), null);
    loadMoreSentinel({ collection, onLoadMore, scrollOffset }, sentinel);
    const dom = globalDOMProps(props, ["style"]);
    const cls = props.class ?? "rv-ListBoxLoadingIndicator";
    const style = props.style;
    const children = props.children;
    return (
      <>
        <div style={{ position: "relative", width: 0, height: 0 }} inert>
          <div data-testid="loadMoreSentinel" ref={sentinel as never} style={{ position: "absolute", height: "1px", width: "1px" }} />
        </div>
        {children != null ? (
          <Show when={() => !!read(isLoading)}>
            {() => (
              <div {...dom} ref={ref as never} class={cls} style={style} role="option" tabIndex={-1}>
                {children as never}
              </div>
            )}
          </Show>
        ) : null}
      </>
    );
  },
) as (props: ListBoxLoadMoreItemProps) => unknown;
