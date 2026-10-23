// Ported from react-aria-components (src/TagGroup.tsx), Apache-2.0, © Adobe.
//
// TagGroup, TagList, Tag + contexts: a focusable list of labels, categories, keywords, filters or
// other items with keyboard navigation (horizontal, RTL), selection, actions, links and removal
// (`onRemove`, Delete / Backspace, a `<Button slot="remove">` per tag), on the @react-aria/tag port
// (`./behaviour.ts`) over the @react-aria/gridlist port (`../grid-list/behaviour.ts`).
//
// Rivet:
// - B5 LIVE collection mode, as GridList: the tags render in place (`data-key`), handlers read the
//   collection back from the TagList's DOM per event; resumed pages need no item model.
// - TagGroup owns the list state (`createListState`) and provides it to TagList / Tag through
//   `TagGroupInternalContext` (RAC: `ListStateContext` + `TagListContext` gridProps + useTagGroup's
//   `hookData` for `onRemove`). `TagListContext` is the public ContextValue of TagList's own props.
// - Render props are accessors (`class={({ isSelected }) => (isSelected() ? "on" : "")}`); hover /
//   focus-visible / pressed states are written on the element by the handlers.
// - `className` → `class` (default `rv-TagGroup`, `rv-TagList`, `rv-Tag`).
// - After the items change, a removed focused tag hands focus to the next / previous enabled tag, or the
//   TagList when none is left (react-stately useFocusedKeyReset + react-aria focus effects;
//   `gridListItemsChanged`).
// Deviation: `isEmpty` (role group, empty state) is known for `items` collections and, when
//   `renderEmptyState` is set, for static children (built with `collectionOf`); other static children
//   count as non-empty.
// Deviation: the remove description (`aria-describedby`, keyboard modality) is attached while the tag
//   has focus (see `./behaviour.ts`).
// `render` (RAC DOMRenderProps) on TagGroup / TagList / Tag: given, the attributes object goes to `render(attrs, renderProps)` instead of the default `<div>`. The SharedElementTransition scope is a `SharedElementContext` provider entry.
// Integration points: `SelectableCollectionContext` filtering (Autocomplete) — rows the `filter` rejects do
//   not render; `ListStateContext` — B5 ListBox.
import { DEV } from "#dev";
import { computed, createContext, signal, untrack, useContext, type Signal } from "@rivetjs/reactivity";
import { Show, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { buildCollection, ItemNode } from "../collections/base.ts";
import {
  Collection,
  CollectionRendererContext,
  DefaultCollectionRenderer,
  collectionOf,
  createLeafComponent,
  type CollectionProps,
} from "../collections/components.tsx";
import { createListState, listSelectionManager, type ListState } from "../collections/list-state.ts";
import type { Collection as ICollection, DisabledBehavior, Key, Node, Selection, SelectionBehavior, SelectionMode } from "../collections/types.ts";
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
import { createId } from "../utils/id.ts";
import type { HoverEvents } from "../utils/types.ts";
import type { PressEvents } from "../interactions/press.tsx";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  mergeRefValues,
  renderProps as resolveRenderProps,
  slotIdRef,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleRenderProps,
} from "../slots/index.tsx";
import { ButtonContext } from "../button/index.tsx";
import { LabelContext } from "../label/index.tsx";
import { TextContext } from "../text/index.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";
import { SharedElementContext, type SharedElementScope } from "../shared-element-transition/transition.tsx";
import { SelectableCollectionContext, type SelectableCollectionContextValue } from "../autocomplete/contexts.ts";
import {
  gridListBlur,
  gridListFocus,
  gridListHighlightDescription,
  gridListItemClick,
  gridListItemDoubleClick,
  gridListItemDragStart,
  gridListItemFocus,
  gridListItemKeyUp,
  gridListItemPointerCancel,
  gridListItemPointerDown,
  gridListItemPointerUp,
  gridListItemsChanged,
  gridListKeyDown,
  gridListKeyDownCapture,
  gridListMouseDown,
  listStateView,
  type AriaGridListOptions,
  type GridListShared,
  type GridListStateLike,
} from "../grid-list/behaviour.ts";
import { eventNode, isFn, ringOf, rowCollection, rowSpec } from "../grid-list/row.ts";
import {
  tagBlur,
  tagFocus,
  tagGroupKeyboardDelegate,
  tagGroupOptions,
  tagGroupProps,
  tagKeyDown,
  tagProps,
  tagRemove,
  type AriaTagOptions,
} from "./behaviour.ts";
import { hasLive, isLive, liveClass, liveKeys } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export type { Key, Selection, SelectionMode, SelectionBehavior } from "../collections/types.ts";
export type { ListState } from "../collections/list-state.ts";

// --- TagGroup ------------------------------------------------------------------------------------

export interface TagGroupProps extends SlotProps, DOMRenderProps<"div", undefined>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** The element's unique identifier. */
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
  /** Whether selection should occur on press up instead of press down. */
  shouldSelectOnPressUp?: boolean;
  /** Handler that is called when a user deletes a tag. */
  onRemove?: (keys: Set<Key>) => void;
  /** Handler that is called when a user performs an action on an item. */
  onAction?: (key: Key) => void;
  /** Whether pressing the escape key should clear selection in the TagGroup or not. Default "clearSelection". */
  escapeKeyBehavior?: "clearSelection" | "none";
  /** The CSS class of the element. @default "rv-TagGroup" */
  class?: string;
  style?: StyleRenderProps<never>["style"];
  /** The label, TagList, description / error message Text parts. */
  children?: unknown;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `TagGroupContext`. */
export const TagGroupContext = createContext<ContextValue<TagGroupProps, HTMLDivElement>>(null);

/** What a TagGroup provides its TagList / Tags (Rivet: RAC `ListStateContext` + `TagListContext` gridProps + `hookData`). */
export interface TagGroupInternal {
  state: ListState;
  shared: GridListShared;
  locale: string;
  direction: "ltr" | "rtl";
  /** The grid's labelling (react-aria useField / useLabel), read at render time. */
  labelledBy: () => string | undefined;
  describedBy: () => string | undefined;
  ariaLabel: string | undefined;
  ariaDetails: string | undefined;
  escapeKeyBehavior: "clearSelection" | "none" | undefined;
  onRemove: ((keys: Set<Key>) => void) | undefined;
  /** Autocomplete filter (SelectableCollectionContext): tags it returns false for do not render. */
  filter?: ((textValue: string, node: Node<any>) => boolean) | undefined;
}
/** The TagGroup a TagList / Tag renders in (null outside one). */
export const TagGroupInternalContext = createContext<TagGroupInternal | null>(null);

/** A tag group is a focusable list of labels, categories, keywords, filters, or other items, with support for keyboard navigation, selection, and removal (RAC `TagGroup`). */
export function TagGroup(inProps: TagGroupProps) {
  const [ownProps, ref] = contextProps(inProps, inProps.ref, TagGroupContext) as [TagGroupProps, RefValue<HTMLDivElement> | undefined];
  // RAC TagGroupInner: an Autocomplete passes its collection props (filter).
  const [props] = contextProps(ownProps as TagGroupProps & SelectableCollectionContextValue<object>, undefined, SelectableCollectionContext as never) as [
    TagGroupProps & SelectableCollectionContextValue<object>,
    unknown,
  ];
  // Resumable closures / bags read locals only (a `props.x` read captures the whole props object).
  const { onAction, shouldSelectOnPressUp, escapeKeyBehavior, onRemove, filter, children } = props;
  const ariaLabel = props["aria-label"],
    ownLabelledBy = props["aria-labelledby"],
    ownDescribedBy = props["aria-describedby"],
    ariaDetails = props["aria-details"];
  const { locale, direction } = useLocale();
  const state = createListState<object>({
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
  });
  const shared: GridListShared = { id: state.id, onAction, linkBehavior: "override", keyboardNavigationBehavior: "tab", shouldSelectOnPressUp };
  // react-aria useField (labelElementType span) + useSlot: the label id while a Label renders.
  const [labelRef, hasLabel] = createSlot(!ariaLabel && !ownLabelledBy);
  const labelId = createId();
  const descriptionId = createSlotId(state.id + "-description");
  const errorId = createSlotId(state.id + "-error");
  const labelledBy = () => [hasLabel() ? labelId : undefined, ownLabelledBy].filter(Boolean).join(" ") || undefined;
  const describedBy = () => [slotIdRef(descriptionId), slotIdRef(errorId), ownDescribedBy].filter(Boolean).join(" ") || undefined;
  const internal: TagGroupInternal = {
    state,
    shared,
    locale,
    direction,
    labelledBy,
    describedBy,
    ariaLabel,
    ariaDetails,
    escapeKeyBehavior,
    onRemove,
    filter,
  };
  const dom = globalDOMProps(props, ["style"]);
  // Live props (P5): a live `class` is an accessor the spread binds (typed as the static string).
  const className = (isLive(props, "class") ? liveClass(props, "rv-TagGroup") : (props.class ?? "rv-TagGroup")) as string;
  dom.class = className;
  const style = props.style;
  const slot = props.slot || undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id: props.id,
      slot,
      class: className,
      style: style as never,
      children: () => (
        <Provider
          values={[
            [LabelContext, { id: labelId, elementType: "span", ref: labelRef }],
            [TagGroupInternalContext, internal],
            [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
          ]}
        >
          {children as never}
        </Provider>
      ),
    };
    return props.render(attrs as never, undefined);
  }
  return (
    <div {...dom} ref={ref as never} id={props.id} slot={slot} style={style as never}>
      <Provider
        values={[
          [LabelContext, { id: labelId, elementType: "span", ref: labelRef }],
          [TagGroupInternalContext, internal],
          [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
        ]}
      >
        {children as never}
      </Provider>
    </div>
  );
}

// --- TagList -------------------------------------------------------------------------------------

/** RAC `TagListRenderProps` (accessors: call them inside bindings). */
export interface TagListRenderProps {
  /** Whether the tag list has no items and should display its empty state. @selector [data-empty] */
  isEmpty: () => boolean;
  /** Whether the tag list is currently focused. @selector [data-focused] */
  isFocused: () => boolean;
  /** Whether the tag list is currently keyboard focused. @selector [data-focus-visible] */
  isFocusVisible: () => boolean;
  /** State of the TagGroup. */
  state: ListState;
}

export interface TagListProps<T = object>
  extends
    Omit<CollectionProps<T>, "disabledKeys">,
    StyleRenderProps<TagListRenderProps>,
    DOMRenderProps<"div", TagListRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Provides content to display when there are no items in the tag list. */
  renderEmptyState?: (props: TagListRenderProps) => unknown;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `TagListContext` (the TagList's own props; RAC also passes useTagGroup's gridProps through it). */
export const TagListContext = createContext<ContextValue<TagListProps<any>, HTMLDivElement>>(null);

/** A tag list is a container for tags within a TagGroup (RAC `TagList`). */
export function TagList<T extends object>(inProps: TagListProps<T>) {
  const ctx = useContext(TagGroupInternalContext);
  const [props, ref] = contextProps(inProps, inProps.ref, TagListContext) as [TagListProps<T>, RefValue<HTMLDivElement> | undefined];
  const { items, children, idScope, renderEmptyState, onMouseDown } = props;
  // RAC: outside a TagGroup (its collection build pass) a TagList is a plain Collection.
  if (!ctx)
    return (
      <Collection items={items} idScope={idScope}>
        {children as never}
      </Collection>
    );
  const { state, shared, locale, direction, labelledBy, describedBy, ariaLabel, ariaDetails, escapeKeyBehavior } = ctx;
  const renderer = useContext(CollectionRendererContext);
  // Resumable: the lazy collection slot captures `customRenderer` (undefined for the default renderer).
  const customRenderer = renderer === DefaultCollectionRenderer ? undefined : renderer;
  const sharedElements: SharedElementScope = {};
  const descriptionId = state.id + "-highlight";
  const options: AriaGridListOptions = tagGroupOptions({
    id: state.id,
    "aria-label": ariaLabel,
    "aria-details": ariaDetails,
    escapeKeyBehavior,
    onAction: shared.onAction,
    shouldSelectOnPressUp: shared.shouldSelectOnPressUp,
    direction,
    locale,
    orientation: "horizontal",
    descriptionId,
  });
  const view = (): GridListStateLike<T> => listStateView(state as ListState<T>, shared);
  const eventOptions = (v: GridListStateLike<T>, el: HTMLElement): AriaGridListOptions => ({
    ...options,
    "aria-labelledby": labelledBy(),
    "aria-describedby": describedBy(),
    keyboardDelegate: tagGroupKeyboardDelegate(v, el, direction),
  });

  const content = () => (
    <Collection items={items} idScope={idScope}>
      {children as never}
    </Collection>
  );
  const itemsOf = items;
  const isEmpty: () => boolean =
    itemsOf != null
      ? () => {
          const list = typeof itemsOf === "function" ? (itemsOf as () => Iterable<T>)() : itemsOf;
          for (const _ of list) return false;
          return true;
        }
      : renderEmptyState
        ? (() => {
            const built = collectionOf(content);
            return () => built().size === 0;
          })()
        : () => false;
  const version = itemsOf != null ? (typeof itemsOf === "function" ? (itemsOf as () => unknown) : () => itemsOf) : () => null;

  const focusWithin = signal(false);
  const wantsStates = isFn(props.class) || isFn(props.style) || !!renderEmptyState;
  const focused: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const ring: InteractionStateOptions = { states: wantsStates ? { isFocused: focused, isFocusVisible: focusVisible } : undefined };
  const values: TagListRenderProps = {
    isEmpty,
    isFocused: () => !!focused?.(),
    isFocusVisible: () => !!focusVisible?.(),
    state,
  };
  const rp = untrack(() =>
    resolveRenderProps(
      { class: props.class, style: props.style, values, defaultClassName: "rv-TagList" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  // Grid attributes (reactive): the render view only needs the size and the focused key.
  const gridAttrs = computed(() => {
    const empty = isEmpty();
    const collection = buildCollection<T>([]);
    const v: GridListStateLike<T> = {
      collection: { ...collection, size: empty ? 0 : 1 } as unknown as ICollection<Node<T>>,
      selectionManager: listSelectionManager(state, collection),
      disabledKeys: state.disabledKeys,
      list: shared,
    };
    return tagGroupProps({ ...options, "aria-labelledby": labelledBy(), "aria-describedby": describedBy() }, v, focusWithin());
  });
  const attr = (name: string) => gridAttrs()[name] as never;
  const highlight = () => {
    const collection = buildCollection<T>([]);
    return gridListHighlightDescription(options, {
      collection,
      selectionManager: listSelectionManager(state, collection),
      disabledKeys: state.disabledKeys,
      list: shared,
    });
  };
  const dom = globalDOMProps(props, ["onMouseDown", "style"]);
  const gridEl = createRef<HTMLDivElement>();
  const rootRef = mergeRefValues<HTMLDivElement>(ref, gridEl);
  // After the items changed: focused-key reset + focus restoration (useListState / useTagGroup effects).
  const cache: { items?: ICollection<Node<T>> } = {};
  clientEffect(() => {
    version();
    const el = gridEl();
    if (!el) return;
    queueMicrotask(() => (cache.items = gridListItemsChanged(state as ListState<T>, el, cache.items)));
  });
  const tagDescription = (
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
      role: () => attr("role"),
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-label": () => attr("aria-label"),
      "aria-labelledby": () => attr("aria-labelledby"),
      "aria-describedby": () => attr("aria-describedby"),
      "aria-details": () => attr("aria-details"),
      "aria-multiselectable": () => attr("aria-multiselectable"),
      "aria-atomic": "false",
      "aria-relevant": "additions",
      "aria-live": () => attr("aria-live"),
      tabindex: () => attr("tabIndex"),
      "data-empty": () => dataBool(isEmpty()),
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
        focusWithin.set(true);
      },
      onFocusOut: (e: FocusEvent) => {
        const v = view();
        gridListBlur(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
        const next = e.relatedTarget as globalThis.Node | null;
        if (!next || !(e.currentTarget as Element).contains(next)) focusWithin.set(false);
      },
      onMouseDown: (e: MouseEvent) => {
        const v = view();
        gridListMouseDown(e as never, eventOptions(v, e.currentTarget as HTMLElement), v);
        onMouseDown?.(e as never);
      },
      onFocus: (e: FocusEvent) => focusStateFocus(ring, e as never),
      onBlur: (e: FocusEvent) => focusStateBlur(ring, e as never),
      children: () => (
        <Provider values={[[SharedElementContext, sharedElements]]}>
          <Show when={() => !(renderEmptyState && isEmpty())}>
            {() => (customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: null, content, idScope }) as never}
          </Show>
          <Show when={() => !!renderEmptyState && isEmpty()}>{() => renderEmptyState!(values) as never}</Show>
        </Provider>
      ),
    };
    return (
      <>
        {props.render(attrs as never, values)}
        {tagDescription}
      </>
    );
  }
  return (
    <>
      <div
        {...dom}
        ref={rootRef as never}
        id={state.id}
        role={attr("role")}
        class={rp.class()}
        style={rp.style()}
        aria-label={attr("aria-label")}
        aria-labelledby={attr("aria-labelledby")}
        aria-describedby={attr("aria-describedby")}
        aria-details={attr("aria-details")}
        aria-multiselectable={attr("aria-multiselectable")}
        aria-atomic="false"
        aria-relevant="additions"
        aria-live={attr("aria-live")}
        tabIndex={attr("tabIndex")}
        data-empty={dataBool(isEmpty())}
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
          focusWithin.set(true);
        }}
        onFocusOut={(e) => {
          const v = view();
          gridListBlur(e, eventOptions(v, e.currentTarget as HTMLElement), v);
          // react-aria useFocusWithin: only when focus leaves the list.
          const next = (e as FocusEvent).relatedTarget as globalThis.Node | null;
          if (!next || !(e.currentTarget as Element).contains(next)) focusWithin.set(false);
        }}
        onMouseDown={(e) => {
          const v = view();
          gridListMouseDown(e, eventOptions(v, e.currentTarget as HTMLElement), v);
          onMouseDown?.(e as never);
        }}
        onFocus={(e) => focusStateFocus(ring, e)}
        onBlur={(e) => focusStateBlur(ring, e)}
      >
        {/* RAC: the tags share one SharedElementTransition scope (a SelectionIndicator animates between them). */}
        <Provider values={[[SharedElementContext, sharedElements]]}>
          <Show when={() => !(renderEmptyState && isEmpty())}>
            {() => (customRenderer ?? DefaultCollectionRenderer).CollectionRoot({ collection: null, content, idScope }) as never}
          </Show>
          <Show when={() => !!renderEmptyState && isEmpty()}>{() => renderEmptyState!(values) as never}</Show>
        </Provider>
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

// --- Tag -----------------------------------------------------------------------------------------

/** RAC `TagRenderProps` (accessors: call them inside bindings). */
export interface TagRenderProps {
  /** The unique id of the tag. */
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
  /** @selector [data-disabled] */
  isDisabled: () => boolean;
  /** @selector [data-selection-mode="single | multiple"] */
  selectionMode: SelectionMode;
  selectionBehavior: () => SelectionBehavior;
  /** Whether the tag group allows items to be removed. @selector [data-allows-removing] */
  allowsRemoving: boolean;
  /** State of the TagGroup. */
  state: ListState;
}

export interface TagProps
  extends
    RenderProps<TagRenderProps>,
    DOMRenderProps<"div", TagRenderProps>,
    LinkDOMProps,
    HoverEvents,
    PressEvents,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "onClick" | "style"> {
  /** A unique id for the tag. */
  id?: Key;
  /** A string representation of the tags's contents, used for accessibility. Required if children is not a plain text string. */
  textValue?: string;
  /** Whether the tag is disabled. */
  isDisabled?: boolean;
  /** Handler that is called when a user performs an action on the item. */
  onAction?: () => void;
  /** Handler that is called when the tag receives focus. */
  onFocus?: (e: FocusEvent) => void;
  /** Handler that is called when the tag loses focus. */
  onBlur?: (e: FocusEvent) => void;
  /** Handler that is called when the tag's focus status changes. */
  onFocusChange?: (isFocused: boolean) => void;
  ref?: RefValue<HTMLDivElement>;
}

const TAG_OWNED = ["onPointerDown", "onPointerUp", "onPointerCancel", "onClick", "onDblClick", "onPointerEnter", "onPointerLeave", "style", "id"] as const;

/** A Tag is an individual item within a TagList (RAC `Tag`). */
export const Tag = /*#__PURE__*/ createLeafComponent(ItemNode, function Tag(props: TagProps, forwardedRef: unknown, item: Node<any>) {
  const ctx = useContext(TagGroupInternalContext);
  if (!ctx) throw new Error("Tag must be rendered inside a TagGroup.");
  const { state, shared, locale, direction, onRemove } = ctx;
  const key = item.key;
  const spec = rowSpec(key, item, props as Record<string, any>);
  const removeButtonId = createId();
  const router = useRouter();
  if (!item.textValue && DEV && typeof document !== "undefined")
    console.warn("A `textValue` prop is required for <Tag> elements with non-plain text children for accessibility.");
  // Resumable closures / bags read locals only (a `props.x` read captures the whole props object).
  const { onHoverStart, onHoverEnd, onHoverChange, onFocus, onBlur, onFocusChange } = props;
  const itemOptions = (node: Node<unknown>): AriaTagOptions => ({ node, isVirtualized: false, router, locale, direction, onRemove, removeButtonId });
  const aria = computed(() => {
    const collection = rowCollection(spec);
    const v: GridListStateLike<unknown> = {
      collection,
      selectionManager: listSelectionManager(state, collection),
      disabledKeys: state.disabledKeys,
      list: shared,
    };
    return {
      ...tagProps(itemOptions(collection.getItem(key)!), v),
      selectionMode: v.selectionManager.selectionMode,
      selectionBehavior: v.selectionManager.selectionBehavior,
    };
  });
  // Render props read the selection alone (not the whole `aria` bag, which also follows focus / press): a resumed
  // render-function child is a region re-created on the first change of any signal it read, so reading `aria()`
  // there re-created the content (and its pressed remove button) on pointerdown.
  const selected = computed(() => listSelectionManager(state, rowCollection(spec)).isSelected(key));
  const view = () => listStateView(state, shared);
  // Resumable: a local const arrow called from the inline JSX handlers (no factory-made closures).
  const fire = <E extends Event>(handler: (e: E, o: AriaTagOptions, v: GridListStateLike<any>) => void, e: E) => {
    const v = view();
    handler(e, itemOptions(eventNode(v, spec)), v);
  };

  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const hovered: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const pressed: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const focusVisible: Signal<boolean> | undefined = wantsStates ? signal(false) : undefined;
  const hover: InteractionStateOptions = {
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
    const isPressed = tagProps({ ...itemOptions(eventNode(v, spec)), ref: el }, v).isPressed;
    setDataAttr(el, "data-pressed", isPressed);
    pressed?.set(isPressed);
  };
  const allowsRemoving = !!onRemove;
  const values: TagRenderProps = {
    id: key,
    isHovered: () => !!hovered?.(),
    isPressed: () => !!pressed?.(),
    isSelected: () => selected(),
    isFocused: () => aria().isFocused,
    isFocusVisible: () => !!focusVisible?.(),
    isDisabled: () => aria().isDisabled,
    selectionMode: untrack(() => aria().selectionMode),
    selectionBehavior: () => aria().selectionBehavior,
    allowsRemoving,
    state,
  };
  const rp = untrack(() =>
    resolveRenderProps(
      { class: props.class, style: props.style, children: props.children, values, defaultClassName: "rv-Tag" },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const row = (name: string) => aria().rowProps[name] as never;
  const cell = (name: string) => aria().gridCellProps[name] as never;
  const dom = globalDOMProps(props, TAG_OWNED);
  const { onPointerDown, onPointerUp, onPointerCancel, onDblClick, onPointerEnter, onPointerLeave } = props as Record<string, any>;
  const focusEvents = { onRemove, locale, onFocus, onBlur, onFocusChange };
  const removeButtonProps = {
    id: removeButtonId,
    "aria-label": untrack(() => aria().removeButtonProps["aria-label"]),
    "aria-labelledby": untrack(() => aria().removeButtonProps["aria-labelledby"]),
    isDisabled: untrack(() => aria().removeButtonProps.isDisabled),
    onPress: () => tagRemove({ onRemove, node: { key } as Node<unknown> }),
  };
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
        "data-href": () => row("data-href"),
        "data-target": () => row("data-target"),
        "data-rel": () => row("data-rel"),
        "data-download": () => row("data-download"),
        "data-ping": () => row("data-ping"),
        "data-referrer-policy": () => row("data-referrer-policy"),
        "data-selected": () => dataBool(aria().isSelected),
        "data-disabled": () => dataBool(aria().isDisabled),
        "data-focused": () => dataBool(aria().isFocused),
        "data-allows-removing": dataBool(allowsRemoving),
        "data-selection-mode": () => (aria().selectionMode === "none" ? undefined : aria().selectionMode),
        onKeyDown: (e: KeyboardEvent) => {
          fire(tagKeyDown, e);
          syncPressed(e);
        },
        onKeyUp: (e: KeyboardEvent) => {
          fire(gridListItemKeyUp, e);
          syncPressed(e);
        },
        onFocusIn: (e: FocusEvent) => fire(gridListItemFocus, e),
        onFocus: (e: FocusEvent) => {
          focusRingFocus(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e);
          tagFocus(e, focusEvents);
        },
        onBlur: (e: FocusEvent) => {
          focusRingBlur(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e);
          tagBlur(e, focusEvents);
        },
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
          <div role="gridcell" aria-colindex={1} aria-errormessage={cell("aria-errormessage")} aria-label={cell("aria-label")} style={{ display: "contents" }}>
            <Provider
              values={[
                [ButtonContext, { slots: { remove: removeButtonProps } }],
                [CollectionRendererContext, DefaultCollectionRenderer],
                [SelectionIndicatorContext, { isSelected: () => selected() }],
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
        data-href={row("data-href")}
        data-target={row("data-target")}
        data-rel={row("data-rel")}
        data-download={row("data-download")}
        data-ping={row("data-ping")}
        data-referrer-policy={row("data-referrer-policy")}
        data-selected={dataBool(aria().isSelected)}
        data-disabled={dataBool(aria().isDisabled)}
        data-focused={dataBool(aria().isFocused)}
        data-allows-removing={dataBool(allowsRemoving)}
        data-selection-mode={aria().selectionMode === "none" ? undefined : aria().selectionMode}
        onKeyDown={(e) => {
          fire(tagKeyDown, e);
          syncPressed(e);
        }}
        onKeyUp={(e) => {
          fire(gridListItemKeyUp, e);
          syncPressed(e);
        }}
        onFocusIn={(e) => fire(gridListItemFocus, e)}
        onFocus={(e) => {
          focusRingFocus(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e);
          tagFocus(e, focusEvents);
        }}
        onBlur={(e) => {
          focusRingBlur(ringOf(e.currentTarget as Element, false, "data-focus-visible", focusVisible), e);
          tagBlur(e, focusEvents);
        }}
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
        <div role="gridcell" aria-colindex={1} aria-errormessage={cell("aria-errormessage")} aria-label={cell("aria-label")} style={{ display: "contents" }}>
          <Provider
            values={[
              [ButtonContext, { slots: { remove: removeButtonProps } }],
              [CollectionRendererContext, DefaultCollectionRenderer],
              [SelectionIndicatorContext, { isSelected: () => selected() }],
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
  // Autocomplete filtering (live mode: per tag; RAC UNSTABLE_useFilteredListState).
  const visible = () => filter(spec.textValue ?? "", rowCollection(spec).getItem(key)!);
  // Server: render right away, inside the collection row's resume region (runtime gap: a function child renders after it closed).
  return <Show when={visible}>{typeof document === "undefined" ? (visible() ? renderRow() : null) : renderRow}</Show>;
}) as (props: TagProps) => unknown;
