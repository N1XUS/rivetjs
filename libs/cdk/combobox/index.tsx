// Ported from react-aria-components ComboBox (packages/react-aria-components/src/ComboBox.tsx: ComboBox,
// ComboBoxValue), Apache-2.0, © Adobe.
// A combo box combines a text input with a listbox, allowing users to filter a list of options to items
// matching a query: `<ComboBox><Label/><Group><Input/><Button/></Group><Popover><ListBox/></Popover></ComboBox>`.
// Rivet:
// - parts come from their folders (Label, Input, Button, Group, Popover, ListBox, Text, FieldError); the
//   combobox provides `LabelContext`, `ButtonContext`, `InputContext`, `FieldInputContext`,
//   `OverlayTriggerStateContext`, `PopoverContext`, `ListBoxContext`, `ListStateContext`, `TextContext`,
//   `GroupContext`, `FieldErrorContext`, `ComboBoxValueContext`, `ComboBoxStateContext`.
// - the collection is built from the children (B5 `collectionOf`: RAC `CollectionBuilder`): the closed popover's
//   ListBox registers its items in a build pass; `items` / `defaultItems` reach it through `ListBoxContext`
//   (a ListBox without children renders them: the `items` preset).
// - state = `createComboBoxCore` + a selection view built here with an inline arrow
//   (`{ ...core, selectionState }`); the ListBox reads a list-state view over it (`ListStateContext`):
//   displayed (filtered / frozen) collection + the combobox's selection.
// - `selectedKey` / `value` / `inputValue`: plain = controlled, Signal = two-way. `isInvalid` may be an accessor.
// - the input's `aria-describedby` names the ComboBoxValue / description / FieldError only while they render (RA
//   useSlotId); server: a slot probe (`probeSlots`) marks them before the input renders (no IDREF to a missing part).
// - render props are accessors (`class={({ isOpen }) => (isOpen() ? "open" : "")}`); `class` = RAC `className`;
//   default classes `rv-ComboBox`, `rv-ComboBoxValue`.
// `render` (RAC DOMRenderProps) on ComboBox / ComboBoxValue (their `<div>`): given, the attributes object goes to `render(attrs, renderProps)`. Deviations: the popover width is the Popover's own
// `--trigger-width` of the trigger (Group, else the input) — the backward-compatible input + button measurement
// without a Group is not ported; Popover `clearContexts` (RAC CLEAR_CONTEXTS) is passed (the Popover provides
// them as null to its content; on a resumed page the tokens resume by id); external changes to `items` / a value Signal re-run the state's update loop from a
// reactive effect created on first interaction (React re-renders).
import { createContext, effect, provide, untrack, useContext } from "@rivetjs/reactivity";
import { clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import type { Content, Ref } from "@rivetjs/runtime/jsx-runtime";
import { ButtonContext } from "../button/index.tsx";
import { collectionOf, isHidden } from "../collections/components.tsx";
import { probeSlots, slotProbing } from "#server";
import type { Key, Node } from "../collections/types.ts";
import type { ListState } from "../collections/list-state.ts";
import { FieldErrorContext } from "../form/field-error.tsx";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { GroupContext } from "../group/index.tsx";
import { useLocale } from "../i18n/index.ts";
import { listFormatter } from "../i18n/list-formatter.ts";
import { InputContext } from "../input/index.tsx";
import { controllable } from "../interactions/controllable.ts";
import { LabelContext } from "../label/index.tsx";
import { ListBoxContext, ListStateContext } from "../listbox/index.tsx";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import type { OverlayTriggerState } from "../state/overlays.ts";
import { TextContext } from "../text/index.tsx";
import { FieldInputContext } from "../autocomplete/contexts.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { useRouter } from "../utils/links.tsx";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  probeSlot,
  removeDataAttributes,
  renderProps,
  slotIdRef,
  type ClassNameOrFunction,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import {
  closeCombo,
  comboBoxSelectionState,
  comboDisplayedCollection,
  comboInputText,
  comboSelectedItems,
  comboSelectionChange,
  comboUpdate,
  comboValue,
  setComboInputValue,
  createComboBoxCore,
  type ChangeValueType,
  type ComboBoxState,
  type ComboBoxStateProps,
  type ComboBoxValidationValue,
  type MenuTriggerAction,
  type SelectionMode,
  type ValueType,
} from "../state/combobox.ts";
import { comboBoxDisposeEffects, comboBoxProps, type AriaComboBoxProps, type ComboBoxRefs } from "./behaviour.tsx";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";

export type { ComboBoxState, MenuTriggerAction, SelectionMode, ValueType, ChangeValueType, ComboBoxValidationValue } from "../state/combobox.ts";
export type { Key } from "../collections/types.ts";

export interface ComboBoxRenderProps {
  /**
   * Whether the combobox is currently open.
   *
   * @selector [data-open]
   */
  isOpen: () => boolean;
  /**
   * Whether the combobox is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the combobox is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the combobox is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /**
   * Whether the combobox is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
}

export interface ComboBoxProps<T = object, M extends SelectionMode = "single">
  extends
    Omit<ComboBoxStateProps<T, M>, "children" | "collection" | "filterLocale" | "validationBehavior" | "validationErrors" | "isInvalid">,
    Omit<
      AriaComboBoxProps,
      "label" | "description" | "errorMessage" | "placeholder" | "validationBehavior" | "validationErrors" | "selectionMode" | "isInvalid" | "validate"
    >,
    RACValidation,
    RenderProps<ComboBoxRenderProps>,
    DOMRenderProps<"div", ComboBoxRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp" | "onInput" | "onBeforeInput"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ComboBox'
   */
  class?: ClassNameOrFunction<ComboBoxRenderProps>;
  /** The filter function used to determine if a option should be included in the combo box list. */
  defaultFilter?: (textValue: string, inputValue: string) => boolean;
  /**
   * Whether the text or key of the selected item is submitted as part of an HTML form. When `allowsCustomValue`
   * is `true`, this option does not apply and the text is always submitted.
   *
   * @default 'key'
   */
  formValue?: "text" | "key";
  /** Whether the combo box allows the menu to be open when the collection is empty. */
  allowsEmptyCollection?: boolean;
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ComboBoxContext`. */
export const ComboBoxContext = createContext<ContextValue<ComboBoxProps<any, SelectionMode>, HTMLDivElement>>(null);
/** RAC `ComboBoxStateContext`. */
export const ComboBoxStateContext = createContext<ComboBoxState<any, SelectionMode> | null>(null);

// Contexts to clear inside the popover.
const CLEAR_CONTEXTS = [LabelContext, ButtonContext, InputContext, FieldInputContext, GroupContext, TextContext];

const OWNED = ["style"] as const;

/** A combo box combines a text input with a listbox, allowing users to filter a list of options to items matching a query. */
export function ComboBox<T = object, M extends SelectionMode = "single">(inProps: ComboBoxProps<T, M>) {
  // RAC createHideableComponent: nothing inside a parent's collection build pass.
  if (isHidden()) return null;
  // Live props (P5): `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` / `items` and the controlled `value` /
  // `selectedKey` / `inputValue` stay live (accessors: read by the state, the bags and the bindings; controlled values
  // are never written), class / style / children from a live view; the rest of the body is read once (untracked: a
  // prop change never re-creates the combobox, also on a resumed page).
  return untrack(() => comboBox(inProps));
}

const COMBO_LIVE = ["isDisabled", "isReadOnly", "isRequired", "isInvalid", "items"] as const;
const COMBO_CONTROLLED = ["value", "selectedKey", "inputValue"] as const;

function comboBox<T, M extends SelectionMode>(inProps: ComboBoxProps<T, M>) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, ComboBoxContext) as [ComboBoxProps<T, M>, RefValue<HTMLDivElement> | undefined];
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, COMBO_LIVE as never, COMBO_CONTROLLED as never) : ctxProps;
  const { children } = props;
  const disabledProp = props.isDisabled as MaybeAccessor<boolean | undefined>,
    requiredProp = props.isRequired as MaybeAccessor<boolean | undefined>,
    readOnlyProp = props.isReadOnly as MaybeAccessor<boolean | undefined>;
  const staticInvalid = typeof props.isInvalid === "function" ? false : props.isInvalid || false;
  const itemsProp = props.items,
    defaultItems = props.defaultItems;
  // The collection content (RAC `useMemo` + CollectionBuilder): the ListBox registers its items.
  // Object-literal function value: a resumable symbol.
  const build = {
    // `provide` (not <Provider>): the build pass evaluates the content synchronously under the context.
    content: () => {
      // An `items` accessor is read here (tracked by the build computed); the ListBox body runs untracked.
      const listItems = itemsProp ?? defaultItems;
      return provide(ListBoxContext, { items: typeof listItems === "function" ? (listItems as () => Iterable<unknown>)() : listItems }, () =>
        typeof children === "function" && !isSlot(children)
          ? (children as (values: unknown) => Content)({
              isOpen: () => false,
              isDisabled: () => !!read(disabledProp),
              isInvalid: () => staticInvalid,
              isRequired: () => !!read(requiredProp),
              defaultChildren: null,
              isReadOnly: () => !!read(readOnlyProp),
            })
          : renderSlot(children as Content),
      );
    },
  };
  const collection = collectionOf(build.content);
  return <ComboBoxInner props={props as ComboBoxProps<any, SelectionMode>} collection={() => collection()} comboBoxRef={ref} />;
}

interface ComboBoxInnerInput {
  props: ComboBoxProps<any, SelectionMode>;
  collection: () => any;
  comboBoxRef: RefValue<HTMLDivElement> | undefined;
}

function ComboBoxInner(input: ComboBoxInnerInput) {
  // Read once (untracked): live values reach the state / bags / bindings as accessors.
  return untrack(() => comboBoxInner(input));
}

function comboBoxInner(input: ComboBoxInnerInput) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const { props, collection, comboBoxRef: ref } = input;
  const name = props.name;
  let formValue = props.formValue ?? "key";
  if (props.allowsCustomValue) {
    formValue = "text";
  }

  const validationBehavior = formValidationBehavior(props.validationBehavior);
  const { locale } = useLocale();
  const core = createComboBoxCore<any, SelectionMode>({
    // Live props: controlled `value` / `selectedKey` / `inputValue` arrive as accessors (read live, never written; the
    // update effect below re-syncs on their change, and on a resumed page the input's value binding does:
    // `comboInputText`). Flags arrive as accessors too.
    ...(props as ComboBoxStateProps<any, SelectionMode>),
    defaultFilter: props.defaultFilter,
    // useFilter({sensitivity: 'base'}).contains (built from the locale on use: functions do not serialize).
    filterLocale: locale,
    // If props.items isn't provided, rely on collection filtering (aka listbox.items is provided or defaultItems provided to Combobox)
    items: props.items,
    children: undefined,
    collection,
    validationBehavior,
    validationErrors: formValidationErrors(),
  });
  const state: ComboBoxState = { ...core, selectionState: comboBoxSelectionState(core, { onSelectionChange: (keys) => comboSelectionChange(core, keys) }) };

  const buttonRef = createRef<HTMLButtonElement>();
  const inputRef = createRef<HTMLInputElement>();
  const groupRef = createRef<HTMLDivElement>();
  const listBoxRef = createRef<HTMLDivElement>();
  const popoverRef = createRef<HTMLDivElement>();
  const refs: ComboBoxRefs = {
    inputRef,
    buttonRef: buttonRef as unknown as Ref<Element>,
    listBoxRef: listBoxRef as unknown as Ref<HTMLElement>,
    popoverRef: popoverRef as unknown as Ref<Element>,
  };
  const initialLabel = !props["aria-label"] && !props["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // RA useValueId: the ComboBoxValue's id while it renders.
  const valueSlot = createSlotId();

  const {
    buttonProps,
    inputProps,
    listBoxProps,
    labelProps,
    descriptionProps,
    errorMessageProps,
    ids,
    listBoxId,
    isInvalid,
    validationErrors,
    validationDetails,
  } = comboBoxProps(
    {
      ...(removeDataAttributes(props) as AriaComboBoxProps),
      label: initialLabel,
      ...refs,
      name: formValue === "text" ? name : undefined,
      validationBehavior,
      labelElementType: "label",
      locale,
      router: useRouter(),
      valueId: () => slotIdRef(valueSlot, false),
    },
    state,
  );

  // RA useSlotId: the description / error ids are described-by while their part renders.
  const descriptionId = createSlotId((descriptionProps.id as string | undefined) ?? (props.id ? props.id + "-description" : undefined));
  const errorId = createSlotId(errorMessageProps.id as string, isInvalid);
  const labelledBy = ids.fieldProps["aria-labelledby"];
  const ownLabelledBy = props["aria-labelledby"];
  const ownDescribedBy = props["aria-describedby"];
  const field = {
    ...inputProps,
    "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
    // Server: the slot probe below has marked the parts that render (`probeSlots`), so no id is kept on expectation.
    "aria-describedby": () =>
      [slotIdRef(valueSlot, false), ownDescribedBy, slotIdRef(descriptionId, false), slotIdRef(errorId, false)].filter(Boolean).join(" ") || undefined,
  };

  // Unmount: dispose the interaction effects (ariaHideOutside, announcements) created on first interaction. Resumed
  // page: registered at the first interaction (nothing to dispose before), so a closed ComboBox boots nothing at idle.
  clientEffect(() => () => comboBoxDisposeEffects(core), { when: "interaction" });

  // External changes (items accessor / value / input Signals written by the app): re-run the update loop.
  const itemsProp = props.items;
  effect(() => {
    if (typeof itemsProp === "function") (itemsProp as () => unknown)();
    core.value();
    core.inputValue();
    untrack(() => comboUpdate(core));
  });

  const disabledProp = props.isDisabled as MaybeAccessor<boolean | undefined>,
    readOnlyProp = props.isReadOnly as MaybeAccessor<boolean | undefined>,
    requiredProp = props.isRequired as MaybeAccessor<boolean | undefined>;
  const renderValues = {
    isOpen: () => core.isOpen(),
    isDisabled: () => !!read(disabledProp),
    isInvalid,
    isRequired: () => !!read(requiredProp),
    isReadOnly: () => !!read(readOnlyProp),
  };
  // Only expose a subset of state to renderProps function to avoid infinite render loop
  const rp = renderProps(
    {
      class: props.class,
      style: props.style as StyleOrFunction<ComboBoxRenderProps> | undefined,
      children: props.children as never,
      values: renderValues,
      defaultClassName: "rv-ComboBox",
    },
    hasLive(props) ? (liveRenderProps(props) as never) : undefined,
  );

  // OverlayTriggerStateContext: the Popover closes through `state.close()` (= commit).
  // Object-literal arrows (resumable symbols); call-argument arrows are not.
  const openIO = {
    read: () => core.isOpen(),
    write: (open: boolean) => {
      if (!open) closeCombo(core);
    },
  };
  const overlayState: OverlayTriggerState = { isOpen: core.isOpen, point: core.point, open: controllable<boolean>(openIO.read, false, openIO.write) };
  // The ListBox's list state: the displayed (filtered / frozen) collection + the combobox selection.
  const listState: ListState = {
    id: listBoxId,
    selectionState: state.selectionState,
    disabledKeys: state.selectionState.disabledKeys,
    items: undefined,
    children: undefined,
    collection: () => comboDisplayedCollection(core),
    filter: undefined,
    suppressTextValueWarning: false,
    layoutDelegate: undefined,
  };

  const dom = globalDOMProps(props, OWNED);
  delete dom.id;
  // The flags go through the root spread: a function (live) attribute value outside a spread is not a server binding.
  dom["data-disabled"] = dataFlag(disabledProp);
  dom["data-readonly"] = dataFlag(readOnlyProp);
  dom["data-required"] = dataFlag(requiredProp);
  const slot = props.slot || undefined;
  const form = props.form;
  const multiple = core.selectionMode === "multiple";
  // Object-literal function value (R2 resumable symbol); an arrow as an array element is not resumable, so the
  // FieldError of a resumed ComboBox never saw the validation.
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };
  const values: ProviderValue<any>[] = [
    [ComboBoxStateContext, state],
    [LabelContext, { ...labelProps, elementType: "label", ref: labelRef }],
    [ButtonContext, { ...buttonProps, ref: buttonRef, isPressed: () => core.isOpen() }],
    [InputContext, { ...field, ref: inputRef }],
    [FieldInputContext, { ...field, ref: inputRef, value: () => comboInputText(core), onChange: (v: string) => setComboInputValue(core, v) }],
    [OverlayTriggerStateContext, overlayState],
    [
      PopoverContext,
      {
        ref: popoverRef,
        triggerRef: () => groupRef() ?? inputRef(),
        scrollRef: listBoxRef,
        placement: "bottom start",
        isNonModal: true,
        trigger: "ComboBox",
        clearContexts: CLEAR_CONTEXTS,
      } as never,
    ],
    [ListBoxContext, { ...listBoxProps, ref: listBoxRef }],
    [ListStateContext, listState],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [GroupContext, { ref: groupRef, isInvalid, isDisabled: disabledProp || false }],
    [FieldErrorContext, fieldError.validation],
    [ComboBoxValueContext, { id: valueSlot }],
  ];
  // Rivet (server): the input renders before its Description / FieldError / ComboBoxValue, and a resumed page never
  // re-renders (RA useSlotId drops unrendered ids after hydration): probe which slotted parts render first.
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  if (props.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-focused": () => dataBool(core.isFocused()),
      "data-open": () => dataBool(core.isOpen()),
      "data-disabled": dataFlag(disabledProp),
      "data-readonly": dataFlag(readOnlyProp),
      "data-invalid": () => dataBool(isInvalid()),
      "data-required": dataFlag(requiredProp),
      children: () => [
        rp.children(),
        name && formValue === "key" ? (
          multiple ? (
            hiddenKeys(core).map((key) => <input type="hidden" name={name} form={form} value={key} />)
          ) : (
            <input type="hidden" name={name} form={form} value={String(comboValue(core) ?? "")} />
          )
        ) : null,
      ],
    };
    return <Provider values={values}>{props.render(attrs as never, renderValues)}</Provider>;
  }
  return (
    <Provider values={values}>
      <div
        {...dom}
        ref={ref as never}
        class={rp.class()}
        style={rp.style()}
        slot={slot}
        data-focused={dataBool(core.isFocused())}
        data-open={dataBool(core.isOpen())}
        data-invalid={dataBool(isInvalid())}
      >
        {rp.children()}
        {name && formValue === "key" ? (
          multiple ? (
            // One input per key (an expression child: the element's region re-renders when the keys change).
            hiddenKeys(core).map((key) => <input type="hidden" name={name} form={form} value={key} />)
          ) : (
            <input type="hidden" name={name} form={form} value={String(comboValue(core) ?? "")} />
          )
        ) : null}
      </div>
    </Provider>
  );
}

/** `data-*` value of a flag: the static value, or a returned accessor while it is live (resumable). */
function dataFlag(flag: MaybeAccessor<boolean | undefined>): "true" | undefined | (() => "true" | undefined) {
  return typeof flag === "function" ? dataReader(flag) : dataBool(flag);
}
function dataReader(flag: () => boolean | undefined): () => "true" | undefined {
  return () => dataBool(flag());
}

/**
 * The hidden input values of a multiple combobox (one per key, or one empty input). Rendered by an expression child
 * of the root: a resumed function child returning a JSX array never re-rendered (runtime, scratchpad runtime-bugs.md),
 * and an expression at a component's fragment root is not reactive on the client.
 */
function hiddenKeys(core: ComboBoxState | ReturnType<typeof createComboBoxCore>): string[] {
  const value = comboValue(core) as readonly Key[];
  return value.length === 0 ? [""] : value.map(String);
}

export interface ComboBoxValueRenderProps<T> {
  /**
   * Whether the value is a placeholder.
   *
   * @selector [data-placeholder]
   */
  isPlaceholder: () => boolean;
  /** The object values of the currently selected items. */
  selectedItems: () => (T | null)[];
  /** The textValue of the currently selected items. */
  selectedText: () => string;
  /** The state of the ComboBox. */
  state: ComboBoxState<T, "single" | "multiple">;
}

export interface ComboBoxValueProps<T = object>
  extends RenderProps<ComboBoxValueRenderProps<T>>, DOMRenderProps<"div", ComboBoxValueRenderProps<T>>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ComboBoxValue'
   */
  class?: ClassNameOrFunction<ComboBoxValueRenderProps<T>>;
  /** The content to display when no items are selected. */
  placeholder?: Content;
  id?: string | { id: string };
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ComboBoxValueContext`. */
export const ComboBoxValueContext = createContext<ContextValue<ComboBoxValueProps<any>, HTMLDivElement>>(null);

/** ComboBoxValue renders the current value of a ComboBox (e.g. the selected items of a multiple combobox). */
export function ComboBoxValue<T = object>(inProps: ComboBoxValueProps<T>) {
  // RAC createHideableComponent: nothing in the collection build pass (outside the ComboBox providers); the server
  // slot probe (`probeSlots`) marks the value slot id.
  if (slotProbing) return (probeSlot(inProps, ComboBoxValueContext), null);
  if (isHidden()) return null;
  const [props, ref] = contextProps(inProps, inProps.ref, ComboBoxValueContext) as [ComboBoxValueProps<T>, RefValue<HTMLDivElement> | undefined];
  const state = useContext(ComboBoxStateContext)! as ComboBoxState<T, "single" | "multiple">;
  const { locale } = useLocale();
  const selectedText = () =>
    listFormatter(locale).format(
      comboSelectedItems(state)
        .map((item: Node<T>) => item?.textValue || "")
        .filter((v) => v !== ""),
    );
  const isPlaceholder = () => comboSelectedItems(state).length === 0;
  const placeholder = props.placeholder;
  const rp = untrack(() =>
    renderProps(
      {
        class: props.class,
        style: props.style as StyleOrFunction<ComboBoxValueRenderProps<T>> | undefined,
        children: props.children as never,
        defaultChildren: (() => selectedText() || placeholder) as never,
        defaultClassName: "rv-ComboBoxValue",
        values: {
          selectedItems: () => comboSelectedItems(state).map((item) => (item.value as T) ?? null),
          selectedText,
          isPlaceholder,
          state,
        },
      },
      hasLive(props) ? (liveRenderProps(props) as never) : undefined,
    ),
  );
  const dom = globalDOMProps(props, OWNED);
  const id = typeof props.id === "string" ? props.id : props.id?.id;
  if (props.render) {
    const attrs = {
      ...dom,
      id,
      ref: ref as never,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-placeholder": () => dataBool(isPlaceholder()),
      children: () => rp.children(),
    };
    return props.render(attrs as never, {
      selectedItems: () => comboSelectedItems(state).map((item) => (item.value as T) ?? null),
      selectedText,
      isPlaceholder,
      state,
    });
  }
  return (
    <div {...dom} id={id} ref={ref as never} class={rp.class()} style={rp.style()} data-placeholder={dataBool(isPlaceholder())}>
      {rp.children()}
    </div>
  );
}
