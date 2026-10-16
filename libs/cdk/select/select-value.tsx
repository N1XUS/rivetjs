// Ported from React Aria Components (Select.tsx: SelectValue, SelectContext, SelectStateContext,
// SelectValueContext), Apache-2.0, © Adobe.
//
// SelectValue renders the current value of a Select, or a placeholder if no value is selected. It is
// usually placed within the trigger button.
// Rivet:
// - render props are accessors (`({ selectedItems, isPlaceholder }) => …` with `selectedItems()`), the
//   slots convention (`../slots/index.tsx`); the content sits in a keyed region (`Show keyed` on the selected keys: re-created when they change), so a value that turns
//   from the placeholder text into elements on a resumed page re-renders as a region, never as a text
//   binding ("Resumed text bindings must stay text").
// - default children: the selected items' content — the Select's item renderer (`SelectContext`
//   `renderItem`, the items preset's option renderer, called with item states off as RAC calls the item's
//   render function) or the item label — and for multiple selection a localized list (`Intl.ListFormat`
//   parts, each item in a `<span data-slot="value-item">`).
// - contexts are registered (`resumableContext`, ids `rv-select`, `rv-select-state`, `rv-select-value`):
//   a re-created region on a resumed page is re-provided with the (serializable) select state.
// - RAC parts mode (the Select built its collection from the children): default children = each selected item's
//   children (`ListBoxItem` content; a render function is called with every state off, as RAC), `selectedItems` /
//   `selectedItem` = the items' object values (`null` for static items), as RAC. Hidden in a collection build pass
//   (RAC createHideableComponent); the content clears `TextContext` (an item's `<Text slot="description">` must not
//   take the Select's description id).
// Deviation (items preset): `selectedItems` are the data items (`{ key, label, textValue, … }`).
import { createContext } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { listFormatter } from "../i18n/list-formatter.ts";
import {
  resumableContext,
  useContext,
  contextProps,
  slottedContext,
  type ContextValue,
  type HTMLProps,
  type RefValue,
  type StyleObject,
} from "../slots/index.tsx";
import { resolveLocale } from "../i18n/index.ts";
import { formatMessage } from "../_adapters/intl.ts";
import type { SelectionBehavior } from "../collections/types.ts";
import { selectedItems, type BuiltItem, type Item, type SelectionMode, type SelectState } from "../state/select.ts";
import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";
import { TextContext } from "../text/index.tsx";
import { Provider } from "../slots/index.tsx";
import { strings } from "./intl.ts";

/**
 * Option render props of the Select `children` slot (adapted from RAC `ListBoxItemRenderProps`: accessors, read
 * them inside bindings). SelectValue renders the slot too, with the states off.
 */
export interface ItemRenderProps {
  isSelected: () => boolean;
  isFocused: () => boolean;
  isDisabled: boolean;
  selectionMode: SelectionMode | "none";
  selectionBehavior: () => SelectionBehavior;
}

/** What a Select gives its SelectValue (RAC: the Select's own props through `SelectContext`). */
export interface SelectContextValue {
  /** Temporary text that occupies the select when it is empty. @default 'Select an item' (localized). An accessor
   *  (a live `placeholder` prop) is read in the placeholder text binding. */
  placeholder?: string | (() => string | undefined) | undefined;
  /** Rivet: the option renderer of the items preset; SelectValue renders the selected items with it. */
  renderItem?: Slot<[item: () => Item, states: ItemRenderProps]> | undefined;
}

/** RAC `SelectContext`. */
export const SelectContext = resumableContext(createContext<ContextValue<SelectContextValue, HTMLDivElement>>(null, { id: "rv-select" }));
/** RAC `SelectStateContext`: the state of the nearest Select (extra children can read and change it). */
export const SelectStateContext = resumableContext(createContext<SelectState<SelectionMode> | null>(null, { id: "rv-select-state" }));
/** RAC `SelectValueContext`: SelectValue props from the Select (`useSelect` `valueProps`: its `id`). */
export const SelectValueContext = resumableContext(createContext<ContextValue<SelectValueProps, HTMLSpanElement>>(null, { id: "rv-select-value" }));

/** RAC `SelectValueRenderProps` (accessors). */
export interface SelectValueRenderProps {
  /** Whether the value is a placeholder. */
  isPlaceholder: () => boolean;
  /** @deprecated The item of the first selected key (RAC parts mode: its object value). */
  selectedItem: () => any;
  /** The items of the currently selected keys (RAC parts mode: their object values, `null` for static items). */
  selectedItems: () => any[];
  /** The textValue of the currently selected items. */
  selectedText: () => string;
  /** The state of the select. */
  state: SelectState<SelectionMode>;
}

export interface SelectValueProps extends HTMLProps<"span"> {
  /** @default 'rv-SelectValue' */
  class?: string | ((values: SelectValueRenderProps & { defaultClassName: string | undefined }) => string | undefined);
  style?: StyleObject;
  ref?: RefValue<HTMLSpanElement>;
  /** Content, or a function of the render props (`defaultChildren`: the default content). */
  children?: Content | ((values: SelectValueRenderProps & { defaultChildren: Content | undefined }) => Content);
}

const listFormat = (locale: string): Intl.ListFormat => listFormatter(locale);

/** SelectValue `selectedText`: the text of a single item, or the items' texts as a localized list (reads the state). */
export function selectedText(state: SelectState<SelectionMode>, locale: string): string {
  const texts = selectedItems(state).map((item) => item.textValue ?? item.label);
  return state.selectionMode === "single" ? (texts[0] ?? "") : listFormat(locale).format(texts);
}

// RAC SelectValue calls an item's render-function children with every state off.
const ITEM_OFF = {
  isHovered: () => false,
  isPressed: () => false,
  isSelected: () => false,
  isFocused: () => false,
  isFocusVisible: () => false,
  isDisabled: () => false,
  selectionMode: "single",
  selectionBehavior: () => "toggle",
  allowsDragging: false,
  isDragging: () => false,
  isDropTarget: () => false,
};

/** Whether the state's items come from a built collection (RAC parts mode). */
const isParts = (state: SelectState<SelectionMode>): boolean => state.items === undefined && !!state.collection;

/** A built item's children (RAC `item.props.children`; a render function gets the states off). */
function itemContent(item: Item): Content {
  const content = (item as BuiltItem).content;
  if (typeof content === "function" && !isSlot(content)) return (content as (values: typeof ITEM_OFF) => Content)(ITEM_OFF);
  return content != null ? renderSlot(content as Content) : item.label;
}

const OFF: Omit<ItemRenderProps, "selectionMode"> = {
  isSelected: () => false,
  isFocused: () => false,
  isDisabled: false,
  selectionBehavior: () => "toggle",
};

/** RAC SelectValue `defaultChildren`: the selected items' content (multiple: a localized list); null when none. */
function defaultContent(state: SelectState<SelectionMode>, locale: string, render: SelectContextValue["renderItem"]): Content {
  const items = selectedItems(state);
  if (!items.length) return null;
  const parts = isParts(state);
  const content = (item: Item): Content => (render ? render(() => item, { ...OFF, selectionMode: "single" }) : parts ? itemContent(item) : item.label);
  if (state.selectionMode === "single") return content(items[0]!);
  let index = 0;
  return (
    <>
      {listFormat(locale)
        .formatToParts(items.map((item) => item.textValue ?? item.label))
        .map((part) => (part.type === "element" ? <span data-slot="value-item">{content(items[index++]!)}</span> : part.value))}
    </>
  );
}

/** A live placeholder's text (a returned arrow: resumable), the localized default when it reads `undefined`. */
function livePlaceholder(placeholder: () => string | undefined, locale: string): () => string {
  return () => placeholder() ?? formatMessage(strings, locale, "selectPlaceholder");
}

function placeholderBranch(text: () => string): () => () => string {
  return () => text;
}

/** SelectValue renders the current value of a Select, or a placeholder if no value is selected. */
export function SelectValue(props: SelectValueProps) {
  // RAC createHideableComponent: nothing in the Select's collection build pass.
  if (slotProbing || isHiddenPart()) return null;
  const [merged, ref] = contextProps(props, props.ref, SelectValueContext);
  const state = useContext(SelectStateContext)!;
  const select = (slottedContext(SelectContext) ?? {}) as SelectContextValue;
  const locale = resolveLocale();
  const placeholderProp = select.placeholder;
  // A live `placeholder` (accessor) stays text: the fallback branch binds it (static path: the string, unchanged).
  const placeholder =
    typeof placeholderProp === "function" ? livePlaceholder(placeholderProp, locale) : (placeholderProp ?? formatMessage(strings, locale, "selectPlaceholder"));
  // `Show` calls a function fallback once as its branch: the live one returns the text accessor (a text binding).
  const fallback = typeof placeholder === "function" ? placeholderBranch(placeholder) : placeholder;
  const renderItem = select.renderItem;
  const { children, class: className, style, ...domProps } = merged as SelectValueProps & Record<string, unknown>;
  // RAC parts mode: the items' object values (`item.value ?? null`); items preset: the data items.
  const parts = isParts(state);
  const values: SelectValueRenderProps = {
    isPlaceholder: () => selectedItems(state).length === 0,
    selectedItem: () => (parts ? (((selectedItems(state)[0] as BuiltItem | undefined)?.value ?? null) as unknown) : (selectedItems(state)[0] ?? null)),
    selectedItems: () => (parts ? selectedItems(state).map((item) => (item as BuiltItem).value ?? null) : selectedItems(state)),
    selectedText: () => selectedText(state, locale),
    state,
  };
  // Region key: the selected items (re-renders the content when they change; "" = placeholder).
  const selectionKey = () =>
    selectedItems(state)
      .map((item) => typeof item.key + ":" + String(item.key))
      .join(" ");
  // Split at component time (a render function vs content), never in a binding reading signals.
  const fn = typeof children === "function" && !isSlot(children) ? (children as Exclude<SelectValueProps["children"], Content>) : null;
  const content = fn ? null : (children as Content);
  const r = ref as never;
  return (
    <span
      {...domProps}
      ref={r}
      class={typeof className === "function" ? className({ ...values, defaultClassName: "rv-SelectValue" }) : (className ?? "rv-SelectValue")}
      style={style}
      data-placeholder={values.isPlaceholder() ? "true" : undefined}
    >
      <Provider values={[[TextContext, null]]}>
        {fn ? (
          <Show when={() => "v" + selectionKey()} keyed>
            {() => fn({ ...values, defaultChildren: defaultContent(state, locale, renderItem) ?? placeholder })}
          </Show>
        ) : content != null ? (
          renderSlot(content)
        ) : (
          <Show when={selectionKey} keyed fallback={fallback}>
            {() => defaultContent(state, locale, renderItem)}
          </Show>
        )}
      </Provider>
    </span>
  );
}
