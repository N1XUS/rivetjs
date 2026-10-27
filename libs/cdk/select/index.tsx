// Ported from React Aria Components (Select.tsx: Select, SelectValue; with the Button, Popover and
// ListBox it composes) and React Aria (@react-aria/select useSelect), Apache-2.0, © Adobe.
//
// Select: a label, a trigger button showing the value (SelectValue) or a placeholder, description,
// field error, the RAC ListBox in a popover of the div overlay layer (`PopoverOverlay`, placement
// "bottom start", `data-trigger="Select"`, width from `--trigger-width` in theme.css) and a hidden
// native <select> carrying the form value (server-rendered: forms post before JS). Data-driven items
// (RAC dynamic collections: `items` + an option slot), built into a collection (`collectionOf`: a
// `<ListBox items>` of `ListBoxItem` / `ListBoxSection` + `Header`) that the popover's ListBox renders
// through `ListStateContext` / `ListBoxContext` (useSelect `menuProps`). Single or multiple selection.
// Render state as data attributes on the root: data-focused, data-focus-visible, data-open,
// data-disabled, data-invalid, data-required. Closed, the popover renders nothing; the trigger
// handles typeahead and ArrowLeft / ArrowRight from the data items.
import { ref as createRef } from "@rivetjs/runtime/dom";
import { effect, provide, signal, untrack } from "@rivetjs/reactivity";
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import type { TransitionClasses } from "@rivetjs/kit/transition";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { resolveLocale } from "../i18n/index.ts";
import { formatMessage } from "../_adapters/intl.ts";
import type { Placement } from "../overlay/position.ts";
import { PopoverOverlay } from "../popover/popover-overlay.tsx";
import {
  ListBox,
  ListBoxContext,
  ListBoxItem,
  ListBoxSection,
  ListStateContext,
  type ListBoxItemRenderProps,
  type ListBoxProps,
  type ListBoxRenderProps,
} from "../listbox/index.tsx";
import { Collection, collectionOf } from "../collections/components.tsx";
import type { ListState } from "../collections/list-state.ts";
import type { Collection as ICollection, Node } from "../collections/types.ts";
import { createMultipleSelectionState, type MultipleSelectionState } from "../selection/state.ts";
import { Header } from "../header/index.tsx";
import { Text } from "../text/index.tsx";
import { FieldError, FieldErrorContext, type FieldErrorProps } from "../form/field-error.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { liveOptions } from "../utils/live.tsx";
import { useValidationBehavior, useValidationErrors } from "../form/index.tsx";
import { displayValidation, type MaybeAccessor, type ValidationBehavior, type ValidationFunction, type ValidationResult } from "../state/form-validation.ts";
import { errorText, fieldDescribedBy, type ErrorMessage } from "../text-field/fields.ts";
import { isSection, type CollectionEntry, type CollectionSection, type Item, type Key, type Selection } from "../state/list.ts";
import {
  createSelectState,
  openSelect,
  selectedItems,
  selectedItemsOf,
  selectedKeys,
  selectValue,
  setSelectValue,
  toggleSelect,
  isSelectDisabled,
  isSelectRequired,
  type ChangeValueType,
  type SelectionMode,
  type SelectState,
  type SelectStateProps,
  type ValueType,
} from "../state/select.ts";
import { strings } from "./intl.ts";
import { SelectParts, type SelectPartsProps } from "./select-parts.tsx";
import { HiddenSelect } from "./hidden-select.tsx";
import { Provider } from "../slots/index.tsx";
import {
  SelectContext,
  SelectStateContext,
  SelectValue,
  SelectValueContext,
  selectedText,
  type ItemRenderProps,
  type SelectContextValue,
  type SelectValueProps,
  type SelectValueRenderProps,
} from "./select-value.tsx";
import {
  listId,
  popoverId,
  selectFocusWithin,
  selectLabelClick,
  selectListBlur,
  selectListChange,
  selectProps,
  selectTriggerBlur,
  selectTriggerClick,
  selectTriggerFocus,
  selectTriggerKeyDown,
  selectTriggerKeyUp,
  selectTriggerMouseDown,
  selectTriggerPointerDown,
  syncListSelection,
  triggerId,
  TRIGGER_KEYS,
  valueId,
  type SelectCallbacks,
} from "./behaviour.tsx";

export type { Item, Key, Selection, CollectionEntry, SelectionMode, SelectState, ValueType, ChangeValueType, ItemRenderProps };
export type { HiddenSelectProps, AriaHiddenSelectProps } from "./hidden-select.tsx";
export { SelectValue, SelectContext, SelectStateContext, SelectValueContext, selectedText };
export type { SelectValueProps, SelectValueRenderProps, SelectContextValue };
export { createSelectState, setSelectValue, selectValue, selectedKeys, selectedItems, selectedItemsOf, openSelect, toggleSelect, HiddenSelect };
export { removeSelected, clearSelection, toggleSelected } from "./behaviour.tsx";
export type { SelectPartsProps, SelectPartsRenderProps } from "./select-parts.tsx";

/** RAC `SelectRenderProps` (the slot re-renders when they change). */
export interface SelectRenderProps {
  /** Whether the select is focused, either via a mouse or keyboard. */
  isFocused: boolean;
  /** Whether the select is keyboard focused. */
  isFocusVisible: boolean;
  /** Whether the select is disabled. */
  isDisabled: boolean;
  /** Whether the select is currently open. */
  isOpen: boolean;
  /** Whether the select is invalid. */
  isInvalid: boolean;
  /** Whether the select is required. */
  isRequired: boolean;
}

/**
 * @deprecated Snapshot render props of the `renderValue` preset prop (removed with the parts rewrite: use
 * `<SelectValue>{(renderProps) => …}</SelectValue>`, whose `SelectValueRenderProps` are accessors).
 */
export interface SelectValueSnapshot {
  /** Whether the value is a placeholder. */
  isPlaceholder: boolean;
  /** @deprecated The item of the first selected key. */
  selectedItem: Item | null;
  /** The items of the currently selected keys. */
  selectedItems: Item[];
  /** The textValue of the currently selected items. */
  selectedText: string;
  /** The state of the select. */
  state: SelectState<SelectionMode>;
}

/** Global DOM events the trigger button handles itself; the user's handlers run from its own. */
const TRIGGER_OWNED = ["onPointerDown", "onMouseDown", "onClick"] as const;

/**
 * Global DOM events and attributes (RAC GlobalDOMAttributes) go to the root element (RAC `Select`);
 * the parts RAC composes take theirs through `triggerProps` (the `<Button>`), `valueProps`
 * (`<SelectValue>`), `popoverProps` (`<Popover>`) and `listBoxProps` (`<ListBox>`).
 */
export interface SelectProps<M extends SelectionMode = "single">
  extends Omit<SelectStateProps<M>, "validationErrors" | "id">, SelectCallbacks, TransitionClasses, GlobalDOMAttributes<HTMLDivElement> {
  /** Visible label (omit and pass `aria-label` / `aria-labelledby` instead). */
  label?: Content;
  description?: Content;
  /** Error message (or a function of the validation); default: the validation errors. */
  errorMessage?: ErrorMessage<Content>;
  /** Temporary text that occupies the select when it is empty. @default 'Select an item' (localized) */
  placeholder?: string;
  /** @default "native" (or the enclosing `<Form>`'s) */
  validationBehavior?: ValidationBehavior;
  isInvalid?: MaybeAccessor<boolean | undefined>;
  validate?: ValidationFunction<M extends "single" ? Key : Key[]>;
  /** Describes the type of autocomplete functionality the hidden select should provide. */
  autoComplete?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Base id: root `<id>`, trigger `<id>-trigger`, value `<id>-value`, listbox `<id>-listbox`; generated when omitted. */
  id?: string;
  /** Shared state (e.g. a clear button calling `setSelectValue(state, null)`); else one is created from the props. */
  state?: SelectState<M>;
  /** The placement of the popover with respect to the trigger. @default 'bottom start' */
  placement?: Placement;
  /** The additional offset applied along the main axis between the popover and the trigger. @default 8 */
  offset?: number;
  crossOffset?: number;
  shouldFlip?: boolean;
  maxHeight?: number;
  /** Root class. @default 'rv-Select' */
  class?: string;
  /** @default 'rv-Select-trigger' */
  triggerClass?: string;
  /** @default 'rv-SelectValue' */
  valueClass?: string;
  /** @default 'rv-Label' */
  labelClass?: string;
  descriptionClass?: string;
  errorClass?: string;
  /** Class of the popover around the listbox. @default 'rv-Select-popover' */
  popoverClass?: string;
  /** @default 'rv-ListBox' */
  listClass?: string;
  /** `ListBoxItem` class. @default 'rv-ListBoxItem' */
  optionClass?: string;
  /** `ListBoxSection` class. @default 'rv-ListBoxSection' */
  sectionClass?: string;
  /** Section `Header` class. @default 'rv-Header' */
  headerClass?: string;
  /** Option content (default: the label, and the description when set). SelectValue renders it too (states off). */
  children?: Slot<[item: () => Item, states: ItemRenderProps]>;
  /** Custom SelectValue content (RAC `<SelectValue>{renderProps => …}</SelectValue>`). */
  renderValue?: Slot<[props: SelectValueSnapshot]>;
  /** Extra trigger content after the value (an arrow icon, say), or a function of the render props. */
  indicator?: Content | Slot<[props: SelectRenderProps]>;
  /** Content shown in the listbox when there are no items (with `allowsEmptyCollection`). */
  renderEmptyState?: Content;
  /** Global DOM events and attributes of the trigger button. */
  triggerProps?: GlobalDOMAttributes<HTMLButtonElement>;
  /** Global DOM events and attributes of the SelectValue element. */
  valueProps?: GlobalDOMAttributes<HTMLSpanElement>;
  /** Global DOM events and attributes of the popover element. */
  popoverProps?: GlobalDOMAttributes<HTMLDivElement>;
  /** Global DOM events and attributes of the `ListBox` element (its own handlers run first). */
  listBoxProps?: GlobalDOMAttributes<HTMLDivElement>;
}

/** A select displays a collapsible list of options and allows a user to select one or more of them. */
export function Select<M extends SelectionMode = "single">(props: SelectProps<M> | SelectPartsProps<M>) {
  // RAC parts form (no `items`, no shared `state`): Label / Button / SelectValue / Popover / ListBox children.
  if (untrack(() => (props as SelectProps<M>).items === undefined && (props as SelectProps<M>).state === undefined))
    return <SelectParts props={props as SelectPartsProps<M>} />;
  return <SelectPreset props={props as SelectProps<M>} />;
}

function SelectPreset<M extends SelectionMode = "single">(input: { props: SelectProps<M> }) {
  // Live props (P5, LIVE-SWEEP): `isDisabled` / `isInvalid` / `isRequired` / `placeholder` / `aria-describedby` /
  // controlled `value` / `selectedKey` live; body reads read once.
  const props = liveOptions(
    input.props,
    ["isDisabled", "isInvalid", "isRequired", "placeholder", "aria-describedby"] as never,
    ["value", "selectedKey"] as never,
  );
  return untrack(() => selectPreset(props));
}

function selectPreset<M extends SelectionMode = "single">(props: SelectProps<M>) {
  const validationBehavior = useValidationBehavior(props.validationBehavior);
  const state = (props.state ??
    createSelectState<M>({ ...props, validationBehavior, validationErrors: useValidationErrors() })) as unknown as SelectState<SelectionMode>;
  const single = state.selectionMode === "single";
  // The listbox's selection state (useListState of useSelectState): controlled by the value (`syncListSelection`);
  // a pick reports through `selectListChange`. useSelect menuProps `disallowEmptySelection: true` only stops Escape
  // clearing the listbox selection (`escapeKeyBehavior: "none"` below; a multiple select may still be emptied by
  // toggling); single keeps its key on re-press, and duplicate events close the menu.
  const rootRef = createRef<HTMLDivElement>();
  // The selection signal is its own const: a resumable closure must not reference the object it is created in.
  const initialKeys: readonly Key[] = untrack(() => selectedKeys(state));
  const listKeys = signal<Selection>(new Set(initialKeys));
  const selection: MultipleSelectionState = {
    ...createMultipleSelectionState({
      selectionMode: state.selectionMode,
      disallowEmptySelection: single,
      allowDuplicateSelectionEvents: true,
      selectedKeys: listKeys,
      disabledKeys: state.disabledKeys,
      onSelectionChange: (keys) => selectListChange(state, listKeys, keys, rootRef()),
    }),
    controlled: true,
  };
  const aria = selectProps(props, state);
  const ids = aria.ids;
  const ariaLabel = aria.triggerProps["aria-label"];
  const triggerLabelledBy = aria.triggerProps["aria-labelledby"];
  const menuLabelledBy = aria.menuProps["aria-labelledby"];
  const labelElementId = aria.labelProps.id;
  const locale = resolveLocale();
  const placeholder = props.placeholder ?? formatMessage(strings, locale, "selectPlaceholder");
  const { errorMessage, children: render, renderValue, indicator, onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp } = props;
  const callbacks: SelectCallbacks = { onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp };
  const validation = state.validation;
  // RAC FieldError children: the preset's `errorMessage` (content, or a function of the validation
  // snapshot); undefined → the validation errors. Passed as a prop (a JSX child would always be a slot).
  const errorChildren: FieldErrorProps["children"] =
    typeof errorMessage === "function"
      ? (renderProps) =>
          (errorMessage as (validation: ValidationResult) => Content)({
            isInvalid: renderProps.isInvalid(),
            validationErrors: renderProps.validationErrors(),
            validationDetails: renderProps.validationDetails(),
          })
      : (errorMessage as Content | undefined);
  const errorClass = props.errorClass;
  // A const arrow (resumable closure): the FieldErrorContext value.
  const fieldValidation = (): ValidationResult => displayValidation(validation);
  const isInvalid = () => displayValidation(validation).isInvalid;
  // Destructured first: a bag literal reading `props.x` would capture the whole props object (not serializable).
  const { enter, enterFrom, enterTo, entered, leave, leaveFrom, leaveTo, listClass = "rv-ListBox" } = props;
  const transition: TransitionClasses = { enter, enterFrom, enterTo, entered, leave, leaveFrom, leaveTo };
  const empty = props.renderEmptyState;
  // The popover sits in its own (reactive) binding site, the overlay anchor: read its props here so
  // that binding does not capture the whole props object (JSX label / description included).
  const placement = props.placement ?? "bottom start",
    offset = props.offset,
    crossOffset = props.crossOffset,
    shouldFlip = props.shouldFlip,
    maxHeight = props.maxHeight,
    popoverClass = props.popoverClass ?? "rv-Select-popover";
  const { optionClass, sectionClass, headerClass } = props;
  // Read up front: an element with a spread is one binding, and it must not capture `props` (rendered content).
  const { triggerProps, listBoxProps } = props;
  const domProps = globalDOMProps(props),
    triggerDOMProps = globalDOMProps(triggerProps ?? {}, TRIGGER_OWNED),
    valueDOMProps = globalDOMProps(props.valueProps ?? {}),
    popoverDOMProps = globalDOMProps(props.popoverProps ?? {}),
    listDOMProps = globalDOMProps(listBoxProps ?? {});
  const triggerPointerDown = triggerProps?.onPointerDown,
    triggerMouseDown = triggerProps?.onMouseDown,
    triggerClick = triggerProps?.onClick;
  // RAC Select's collection (CollectionBuilder): a ListBox of the items, built in a pass (closed popover included).
  const items = props.items;
  const option = (item: CollectionEntry): unknown => selectOption(item, render, optionClass, sectionClass, headerClass);
  // The ListBox's list state (RAC ListStateContext): the built collection + the value-controlled selection.
  const listState: ListState = {
    id: listId(state),
    selectionState: selection,
    disabledKeys: selection.disabledKeys,
    items: undefined,
    children: undefined,
    // Built on use, cached per instance (`listKeys`): a computed holding the JSX content does not serialize.
    collection: () => selectListCollection(listKeys, items, option),
    filter: undefined,
    suppressTextValueWarning: false,
    layoutDelegate: undefined,
  };
  // useSelect `menuProps` (ListBoxContext); the user's `listBoxProps` handlers run after the ListBox's own.
  const listBoxContext: ListBoxProps<CollectionEntry> = {
    ...listDOMProps,
    id: listId(state),
    class: listClass,
    "aria-labelledby": menuLabelledBy,
    autoFocus: () => untrack(state.focusStrategy) || true,
    shouldSelectOnPressUp: true,
    shouldFocusOnHover: true,
    linkBehavior: "selection",
    escapeKeyBehavior: "none",
    onBlur: (event: FocusEvent) => selectListBlur(state, event, callbacks),
    ...(empty != null ? { renderEmptyState: (values: ListBoxRenderProps): Content => selectEmptyState(values, empty) } : {}),
  };
  const rootClass = props.class ?? "rv-Select",
    rootId = props.id,
    triggerClass = props.triggerClass ?? "rv-Select-trigger",
    autoFocus = props.autoFocus,
    autoComplete = props.autoComplete,
    label = props.label,
    description = props.description,
    labelClass = props.labelClass ?? "rv-Label",
    descriptionClass = props.descriptionClass ?? "rv-Text",
    valueClass = props.valueClass ?? "rv-SelectValue";
  return (
    <div
      {...domProps}
      ref={rootRef}
      class={rootClass}
      id={rootId}
      data-focused={dataBool(state.isFocused())}
      data-focus-visible={dataBool(state.isFocused() && state.isFocusVisible())}
      data-open={dataBool(state.isOpen())}
      data-disabled={dataBool(isSelectDisabled(state))}
      data-invalid={dataBool(isInvalid())}
      data-required={dataBool(isSelectRequired(state))}
      onFocusIn={(event) => selectFocusWithin(state, event)}
      onFocusOut={(event) => selectFocusWithin(state, event)}
    >
      {label != null ? (
        <span id={labelElementId} class={labelClass} data-slot="label" onClick={(event) => selectLabelClick(state, event)}>
          {label}
        </span>
      ) : null}
      <button
        {...triggerDOMProps}
        type="button"
        id={triggerId(state)}
        class={triggerClass}
        aria-haspopup="listbox"
        aria-expanded={state.isOpen() ? "true" : "false"}
        aria-controls={state.isOpen() ? listId(state) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={triggerLabelledBy}
        aria-describedby={fieldDescribedBy(state, ids, errorMessage)}
        disabled={isSelectDisabled(state) || undefined}
        autoFocus={autoFocus}
        data-pressed={state.isOpen() ? "true" : undefined}
        data-rk={TRIGGER_KEYS}
        onKeyDown={(event) => selectTriggerKeyDown(state, event, callbacks)}
        onKeyUp={(event) => selectTriggerKeyUp(state, event, callbacks)}
        onPointerDown={
          triggerPointerDown
            ? (event) => {
                selectTriggerPointerDown(state, event);
                triggerPointerDown(event);
              }
            : (event) => selectTriggerPointerDown(state, event)
        }
        onMouseDown={
          triggerMouseDown
            ? (event) => {
                selectTriggerMouseDown(event);
                triggerMouseDown(event);
              }
            : selectTriggerMouseDown
        }
        onClick={
          triggerClick
            ? (event) => {
                selectTriggerClick(state, event);
                triggerClick(event);
              }
            : (event) => selectTriggerClick(state, event)
        }
        onFocus={(event) => selectTriggerFocus(state, event, callbacks)}
        onBlur={(event) => selectTriggerBlur(state, event, callbacks)}
      >
        <Provider
          values={[
            [SelectStateContext, state],
            [SelectContext, { placeholder, renderItem: render }],
            [SelectValueContext, { ...valueDOMProps, id: valueId(state), class: valueClass }],
          ]}
        >
          {renderValue ? <SelectValue>{(values) => renderValue(valueSnapshot(values))}</SelectValue> : <SelectValue />}
        </Provider>
        {typeof indicator === "function" ? (indicator as Slot<[SelectRenderProps]>)(selectRenderProps(state)) : indicator}
      </button>
      {description != null ? (
        <span id={ids.descriptionId} class={descriptionClass} data-slot="description">
          {description}
        </span>
      ) : null}
      <Provider values={[[FieldErrorContext, fieldValidation]]}>
        <FieldError id={ids.errorMessageId} class={errorClass} children={errorChildren} />
      </Provider>
      {/* Own binding site (the anchor): on a resumed page the first open re-creates only the popover. */}
      <span data-rv-overlay-anchor="" style={{ display: "contents" }}>
        <PopoverOverlay
          {...popoverDOMProps}
          id={popoverId(state)}
          triggerId={triggerId(state)}
          state={state}
          placement={placement}
          offset={offset}
          crossOffset={crossOffset}
          shouldFlip={shouldFlip}
          maxHeight={maxHeight}
          role={null}
          class={popoverClass}
          attributes={{ "data-trigger": "Select" }}
          {...transition}
        >
          {() => {
            // The listbox shows the current value however the menu opened, and follows it while open.
            effect(() => syncListSelection(state, listKeys, selectedKeys(state)));
            // Synchronous provide (a JSX Provider child is a lazy slot that may render outside the scope).
            return provide(ListStateContext, listState, () => provide(ListBoxContext, listBoxContext, () => ListBox({}))) as never;
          }}
        </PopoverOverlay>
      </span>
      <HiddenSelect state={state} autoComplete={autoComplete} />
    </div>
  );
}

/** ListBox `renderEmptyState` of the preset (`renderEmptyState` content). */
function selectEmptyState(_values: ListBoxRenderProps, empty: Content): Content {
  return empty;
}

const builtCollections = new WeakMap<object, () => ICollection<Node<unknown>>>();

/** The select's collection (RAC CollectionBuilder): a `<ListBox items>` of `selectOption`s, built once per instance. */
function selectListCollection(instance: object, items: SelectProps["items"], option: (item: CollectionEntry) => unknown): ICollection<Node<unknown>> {
  let built = builtCollections.get(instance);
  if (!built) {
    // Built where the popover reads it (inside its ListStateContext): the build pass must not see that state.
    built = collectionOf(() =>
      provide(ListStateContext, null, () => provide(ListBoxContext, null, () => ListBox({ items: items as never, children: option }))),
    ) as () => ICollection<Node<unknown>>;
    builtCollections.set(instance, built);
  }
  return built();
}

/**
 * A data entry → RAC collection element: an item → `ListBoxItem` (content: the `children` slot with the option
 * render props, else the label, plus a description `Text` slot); a section → `ListBoxSection` + `Header`.
 */
function selectOption(
  entry: CollectionEntry,
  render: SelectProps["children"],
  optionClass: string | undefined,
  sectionClass: string | undefined,
  headerClass: string | undefined,
): unknown {
  if (isSection(entry)) {
    const section = entry as CollectionSection;
    const child = (item: CollectionEntry): unknown => selectOption(item, render, optionClass, sectionClass, headerClass);
    return (
      <ListBoxSection {...globalDOMProps(section)} id={section.key} class={sectionClass} aria-label={section["aria-label"]} items={section.children}>
        {section.title ? <Header class={headerClass}>{section.title}</Header> : null}
        <Collection items={section.children} children={child} />
      </ListBoxSection>
    );
  }
  const item = entry as Item & GlobalDOMAttributes<HTMLElement> & { textValue?: string; "aria-label"?: string };
  const children = render
    ? (values: ListBoxItemRenderProps) =>
        render(() => item, {
          isSelected: values.isSelected,
          isFocused: values.isFocused,
          isDisabled: untrack(values.isDisabled),
          selectionMode: values.selectionMode,
          selectionBehavior: values.selectionBehavior,
        })
    : item.description != null
      ? // A render function: JSX made in the collection build pass is a hidden part there (renders nothing).
        () => [<Text slot="label">{item.label}</Text>, <Text slot="description">{item.description}</Text>]
      : item.label;
  return (
    <ListBoxItem
      {...globalDOMProps(item)}
      id={item.key}
      class={optionClass}
      textValue={item.textValue ?? item.label}
      aria-label={item["aria-label"]}
      isDisabled={item.disabled}
      href={item.href}
      children={children as never}
    />
  );
}

/** Render props of the Select (reads the state: call inside a binding). */
function selectRenderProps(state: SelectState<SelectionMode>): SelectRenderProps {
  return {
    isFocused: state.isFocused(),
    isFocusVisible: state.isFocused() && state.isFocusVisible(),
    isDisabled: isSelectDisabled(state),
    isOpen: state.isOpen(),
    isInvalid: displayValidation(state.validation).isInvalid,
    isRequired: isSelectRequired(state),
  };
}

/** `renderValue` snapshot of the SelectValue render props (reads the state: called inside its region). */
function valueSnapshot(values: SelectValueRenderProps): SelectValueSnapshot {
  const items = values.selectedItems();
  return { isPlaceholder: items.length === 0, selectedItem: items[0] ?? null, selectedItems: items, selectedText: values.selectedText(), state: values.state };
}
