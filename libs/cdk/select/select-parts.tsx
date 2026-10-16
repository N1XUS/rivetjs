// Ported from React Aria Components (Select.tsx: Select / SelectInner, parts form) and React Aria
// (@react-aria/select useSelect, @react-aria/menu useMenuTrigger type "listbox"), Apache-2.0, © Adobe.
//
// RAC parts form of the Select (no `items`): `<Select><Label/><Button><SelectValue/></Button><Text slot="description"/>
// <FieldError/><Popover><ListBox>…</ListBox></Popover></Select>`. The Select provides SelectContext,
// SelectStateContext, SelectValueContext, LabelContext, ButtonContext, OverlayTriggerStateContext, PopoverContext,
// ListBoxContext, ListStateContext, TextContext (description / errorMessage slots) and FieldErrorContext; the
// collection is built from the children (B5 `collectionOf` = RAC CollectionBuilder: the closed popover's ListBox
// registers its items in a build pass), and the HiddenSelect renders after the children (form value, autofill).
// Rivet:
// - render props are accessors (`class={({ isOpen }) => (isOpen() ? "open" : "")}`); `class` = RAC `className`,
//   default `rv-Select`.
// - state = `createSelectState({ collection })` (react-stately useSelectState with the built collection; region
//   state): the closed trigger's typeahead / ArrowLeft / ArrowRight, HiddenSelect options and SelectValue read the
//   built items through `selectEntries`. The ListBox renders on a list state over the same collection whose
//   selection mirrors the value (`syncListSelection`, as the items preset).
// - trigger: useMenuTrigger press callbacks (`selectTriggerPressStart` / `selectTriggerPress`) + the useSelect
//   keyboard / focus handlers, given to the `<Button>` through `ButtonContext` (RAC: `triggerProps`).
// - the trigger's `aria-labelledby` / `aria-describedby` follow the Label / description / error parts that render
//   (RA useSlot / useSlotId); server: a slot probe (`probeSlots`) marks them before the trigger renders.
// - `render` (RAC DOMRenderProps) replaces the root `<div>` (`render(attrs, renderProps)`).
import { effect, signal, untrack } from "@rivetjs/reactivity";
import { clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { focusSafely } from "../focus/index.ts";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { ButtonContext } from "../button/index.tsx";
import { collectionOf, isHidden } from "../collections/components.tsx";
import { probeSlots, slotProbing } from "#server";
import type { ListState } from "../collections/list-state.ts";
import type { Collection as ICollection, Node } from "../collections/types.ts";
import { FieldErrorContext } from "../form/field-error.tsx";
import { useValidationBehavior, useValidationErrors } from "../form/index.tsx";
import { resolveLocale } from "../i18n/index.ts";
import { formatMessage } from "../_adapters/intl.ts";
import { LabelContext } from "../label/index.tsx";
import { ListBoxContext, ListStateContext } from "../listbox/index.tsx";
import { OverlayTriggerStateContext, PopoverContext } from "../overlay/contexts.ts";
import { createMultipleSelectionState, type MultipleSelectionState } from "../selection/state.ts";
import { displayValidation, type MaybeAccessor, type ValidationBehavior, type ValidationFunction, type ValidationResult } from "../state/form-validation.ts";
import type { Key, Selection } from "../state/list.ts";
import {
  createSelectState,
  isSelectDisabled,
  isSelectRequired,
  selectedKeys,
  type SelectionMode,
  type SelectState,
  type SelectStateProps,
} from "../state/select.ts";
import { TextContext } from "../text/index.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { liveOptions } from "../utils/live.tsx";
import { renderPropsOf } from "../slots/index.tsx";
import { read } from "../interactions/utils.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import type { DOMRenderProps } from "../utils/render.ts";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  renderProps,
  slotIdRef,
  type ClassNameOrFunction,
  type ContextValue,
  type ProviderValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleOrFunction,
} from "../slots/index.tsx";
import { HiddenSelect } from "./hidden-select.tsx";
import { strings } from "./intl.ts";
import { SelectContext, SelectStateContext, SelectValueContext } from "./select-value.tsx";
import {
  listId,
  popoverId,
  selectFocusWithin,
  selectLabelClick,
  selectListBlur,
  selectListChange,
  selectDisabled,
  selectDisabledAttr,
  selectRequiredAttr,
  selectProps,
  selectTriggerBlur,
  selectTriggerFocus,
  selectTriggerKeyDown,
  selectTriggerKeyDownCapture,
  selectTriggerKeyUp,
  selectTriggerPress,
  selectTriggerPressStart,
  syncListSelection,
  triggerId,
  TRIGGER_KEYS,
  valueId,
  type SelectCallbacks,
} from "./behaviour.tsx";

/** RAC `SelectRenderProps` of the parts form (accessors: read them inside bindings). */
export interface SelectPartsRenderProps {
  /**
   * Whether the select is focused, either via a mouse or keyboard.
   * @selector [data-focused]
   */
  isFocused: () => boolean;
  /**
   * Whether the select is keyboard focused.
   * @selector [data-focus-visible]
   */
  isFocusVisible: () => boolean;
  /**
   * Whether the select is disabled.
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the select is currently open.
   * @selector [data-open]
   */
  isOpen: () => boolean;
  /**
   * Whether the select is invalid.
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the select is required.
   * @selector [data-required]
   */
  isRequired: () => boolean;
}

/** RAC `SelectProps` (parts form: the children are the Select's parts). */
export interface SelectPartsProps<M extends SelectionMode = "single">
  extends
    Omit<SelectStateProps<M>, "items" | "collection" | "validationErrors" | "id" | "validationBehavior" | "isInvalid" | "validate">,
    SelectCallbacks,
    RenderProps<SelectPartsRenderProps>,
    DOMRenderProps<"div", SelectPartsRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   * @default 'rv-Select'
   */
  class?: ClassNameOrFunction<SelectPartsRenderProps>;
  /** Temporary text that occupies the select when it is empty. @default 'Select an item' (localized) */
  placeholder?: string;
  /** @default "native" (or the enclosing `<Form>`'s) */
  validationBehavior?: ValidationBehavior;
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  validate?: ValidationFunction<M extends "single" ? Key : Key[]>;
  /** Describes the type of autocomplete functionality the hidden select should provide. Read once at mount. */
  autoComplete?: string;
  /** Whether the trigger takes focus when the select mounts. Read once at mount (acts at mount only). */
  autoFocus?: boolean;
  /** Read once at mount (combined with the label's id into the trigger's labelling ids). */
  "aria-label"?: string;
  /** Read once at mount (combined with the label's id into the trigger's labelling ids). */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Base id of the parts (`<id>-trigger`, `<id>-value`, `<id>-listbox`, …); generated when omitted. Read once at mount. */
  id?: string;
  ref?: RefValue<HTMLDivElement>;
}

// Contexts to clear inside the popover.
const CLEAR_CONTEXTS = [LabelContext, ButtonContext, TextContext];

const OWNED = ["style"] as const;

/** RAC Select, parts form: builds the collection from the children, then renders `SelectPartsInner`. */
export function SelectParts<M extends SelectionMode = "single">(input: { props: SelectPartsProps<M> }) {
  // RAC createHideableComponent: nothing inside a parent's collection build pass.
  if (isHidden()) return null;
  const [ctxProps, ref] = contextProps(input.props, input.props.ref, SelectContext as never) as [SelectPartsProps<M>, RefValue<HTMLDivElement> | undefined];
  // Live props (P5): `isDisabled` / `isInvalid` and the controlled `value` / `selectedKey` become accessors at the
  // boundary (the select state reads them live); body reads are read once (untracked).
  const props = liveOptions(ctxProps, LIVE_KEYS as never, CONTROLLED_KEYS as never);
  return untrack(() => selectParts(props, ref));
}

/** Live by default (LIVE-SWEEP); read once: `id`, `name`, `form`, `selectionMode`, `disabledKeys`, `aria-label` /
 *  `aria-labelledby`, `autoFocus`, `autoComplete`, `defaultValue`, `validationBehavior`, `validate`, handlers. */
const LIVE_KEYS = ["isDisabled", "isInvalid", "isRequired", "placeholder", "aria-describedby"] as const;
const CONTROLLED_KEYS = ["value", "selectedKey"] as const;

function selectParts<M extends SelectionMode>(props: SelectPartsProps<M>, ref: RefValue<HTMLDivElement> | undefined) {
  const { children } = props;
  const disabledProp = props.isDisabled,
    requiredProp = props.isRequired as MaybeAccessor<boolean | undefined>;
  const staticInvalid = typeof props.isInvalid === "function" ? false : props.isInvalid || false;
  // RAC `useMemo(children(...))` + CollectionBuilder: the ListBox registers its items. Object-literal function value
  // (a resumable symbol: the region state keeps the collection accessor).
  const build = {
    content: () =>
      typeof children === "function" && !isSlot(children)
        ? (children as (values: unknown) => Content)({
            isOpen: () => false,
            isFocused: () => false,
            isFocusVisible: () => false,
            isDisabled: () => !!read(disabledProp),
            isInvalid: () => staticInvalid,
            isRequired: () => !!read(requiredProp),
            defaultChildren: null,
          })
        : renderSlot(children as Content),
  };
  const collection = collectionOf(build.content);
  return <SelectPartsInner props={props as SelectPartsProps<SelectionMode>} collection={() => collection()} selectRef={ref} />;
}

interface SelectPartsInnerInput {
  props: SelectPartsProps<SelectionMode>;
  collection: () => ICollection<Node<unknown>>;
  selectRef: RefValue<HTMLDivElement> | undefined;
}

function SelectPartsInner(input: SelectPartsInnerInput) {
  return untrack(() => selectPartsInner(input));
}

function selectPartsInner(input: SelectPartsInnerInput) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const { props, collection, selectRef: ref } = input;
  const validationBehavior = useValidationBehavior(props.validationBehavior);
  const state = createSelectState<SelectionMode>({
    ...(props as unknown as SelectStateProps<SelectionMode>),
    items: undefined,
    collection,
    validationBehavior,
    validationErrors: useValidationErrors(),
  });
  const single = state.selectionMode === "single";
  // Live props (P5): the live accessor (or the creation value) for bags / contexts; bindings read `isSelectDisabled`.
  const isDisabled = selectDisabled(state);
  const buttonRef = createRef<HTMLButtonElement>();
  // The listbox's selection: controlled by the value (`syncListSelection`), a pick reports through `selectListChange`
  // (useSelectState: single keeps its key on re-press, duplicate events close the menu). Its own const: a resumable
  // closure must not reference the object it is created in.
  const listKeys = signal<Selection>(new Set(untrack(() => selectedKeys(state))));
  const selection: MultipleSelectionState = {
    ...createMultipleSelectionState({
      selectionMode: state.selectionMode,
      disallowEmptySelection: single,
      allowDuplicateSelectionEvents: true,
      selectedKeys: listKeys,
      disabledKeys: state.disabledKeys,
      onSelectionChange: (keys) => selectListChange(state, listKeys, keys, buttonRef()),
    }),
    controlled: true,
  };
  // The listbox shows the current value however the menu opened, and follows it while open.
  effect(() => syncListSelection(state, listKeys, selectedKeys(state)));

  // RA useSlot: whether a Label renders (the trigger is labelled by it).
  const initialLabel = !props["aria-label"] && !props["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  const aria = selectProps({ label: initialLabel, description: true, "aria-label": props["aria-label"], "aria-labelledby": props["aria-labelledby"] }, state);
  // Without a rendered Label (read only when `initialLabel`, i.e. no aria name either): useSelect labels the trigger by
  // its value alone and the menu not at all. Not a second `selectProps` call: `labelProps` would log its dev "no
  // visible label" warning for every Select (it did, 2026-10-12, also with a `<Label>` child).
  const labelledBy = aria.triggerProps["aria-labelledby"],
    labelledByNoLabel = valueId(state);
  const menuLabelledBy = aria.menuProps["aria-labelledby"],
    menuLabelledByNoLabel = undefined;
  const ownDescribedBy = props["aria-describedby"] as MaybeAccessor<string | undefined>;
  // RA useSlotId: the description / error ids are described-by while their part renders.
  const validation = state.validation;
  const isInvalid = () => displayValidation(validation).isInvalid;
  const descriptionId = createSlotId(aria.ids.descriptionId);
  const errorId = createSlotId(aria.ids.errorMessageId, isInvalid);
  const { onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp } = props;
  const callbacks: SelectCallbacks = { onFocus, onBlur, onFocusChange, onKeyDown, onKeyUp };
  const locale = resolveLocale();
  const placeholder = props.placeholder ?? formatMessage(strings, locale, "selectPlaceholder");
  const autoFocus = props.autoFocus,
    autoComplete = props.autoComplete;
  const listBoxRef = createRef<HTMLDivElement>();
  // RA useFocusable autoFocus (the trigger Button only sets the attribute, which a client-rendered button ignores).
  if (autoFocus) {
    const auto = { done: false };
    clientEffect(() => {
      const el = buttonRef();
      if (!auto.done && el) untrack(() => focusSafely(el));
      auto.done = true;
    });
  }

  // The ListBox's list state (RAC ListStateContext = the select state): the built collection + the value-controlled selection.
  const listState: ListState = {
    id: listId(state),
    selectionState: selection,
    disabledKeys: selection.disabledKeys,
    items: undefined,
    children: undefined,
    collection: () => collection(),
    filter: undefined,
    suppressTextValueWarning: false,
    layoutDelegate: undefined,
  };
  // A const arrow (resumable closure): the FieldErrorContext value.
  const fieldValidation = (): ValidationResult => displayValidation(validation);
  const values: ProviderValue<any>[] = [
    [SelectContext, { placeholder }],
    [SelectStateContext, state],
    [SelectValueContext, { id: valueId(state) }],
    [
      LabelContext,
      {
        id: aria.labelProps.id,
        elementType: "span",
        ref: labelRef,
        onClick: (event: MouseEvent & { currentTarget: HTMLElement }) => selectLabelClick(state, event),
      },
    ],
    [
      ButtonContext,
      {
        id: triggerId(state),
        ref: buttonRef,
        "aria-haspopup": "listbox",
        "aria-expanded": () => (state.isOpen() ? "true" : "false"),
        "aria-controls": () => (state.isOpen() ? listId(state) : undefined),
        "aria-label": aria.triggerProps["aria-label"],
        "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : labelledByNoLabel),
        // Server: the slot probe below has marked the parts that render (`probeSlots`), so no id is kept on expectation.
        "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorId, false), read(ownDescribedBy)].filter(Boolean).join(" ") || undefined,
        "data-rk": TRIGGER_KEYS,
        isDisabled,
        autoFocus,
        isPressed: () => state.isOpen(),
        preventFocusOnPress: true,
        onPressStart: (event: { pointerType: string; target: EventTarget | null }) => selectTriggerPressStart(state, event),
        onPress: (event: { pointerType: string; target: EventTarget | null }) => selectTriggerPress(state, event),
        onKeyDown: (event: KeyboardEvent & { currentTarget: HTMLElement }) => selectTriggerKeyDown(state, event, callbacks),
        onKeyUp: (event: KeyboardEvent) => selectTriggerKeyUp(state, event, callbacks),
        onFocus: (event: FocusEvent) => selectTriggerFocus(state, event, callbacks),
        onBlur: (event: FocusEvent) => selectTriggerBlur(state, event, callbacks),
      },
    ],
    [OverlayTriggerStateContext, state],
    [
      PopoverContext,
      {
        id: popoverId(state),
        trigger: "Select",
        triggerRef: buttonRef,
        scrollRef: listBoxRef,
        placement: "bottom start",
        "aria-labelledby": () => (!initialLabel || hasLabel() ? menuLabelledBy : menuLabelledByNoLabel),
        clearContexts: CLEAR_CONTEXTS,
      } as never,
    ],
    [
      ListBoxContext,
      {
        id: listId(state),
        ref: listBoxRef,
        "aria-labelledby": () => (!initialLabel || hasLabel() ? menuLabelledBy : menuLabelledByNoLabel),
        autoFocus: () => untrack(state.focusStrategy) || true,
        shouldSelectOnPressUp: true,
        shouldFocusOnHover: true,
        linkBehavior: "selection",
        escapeKeyBehavior: "none",
        onBlur: (event: FocusEvent) => selectListBlur(state, event, callbacks),
      },
    ],
    [ListStateContext, listState],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [FieldErrorContext, fieldValidation],
  ];

  // Values hoisted: no function in the `rp` initializer (spread sites capture `rp.class` / `rp.style`: per-key live views).
  const rpValues = {
    isOpen: () => state.isOpen(),
    isFocused: () => state.isFocused(),
    isFocusVisible: () => state.isFocused() && state.isFocusVisible(),
    isDisabled: () => isSelectDisabled(state),
    isInvalid,
    isRequired: () => isSelectRequired(state),
  } satisfies SelectPartsRenderProps;
  const rp = renderPropsOf(props as RenderProps<SelectPartsRenderProps>, { values: rpValues, defaultClassName: "rv-Select" });
  // Rivet (server): the trigger renders before its Description / FieldError, and a resumed page never re-renders (RA
  // useSlotId drops unrendered ids after hydration): probe which slotted parts render first.
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  const dom = globalDOMProps(props, OWNED);
  delete dom.id;
  const slot = props.slot || undefined;
  if (props.render) {
    const attrs = {
      ...dom,
      ref,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "data-focused": () => dataBool(state.isFocused()),
      "data-focus-visible": () => dataBool(state.isFocused() && state.isFocusVisible()),
      "data-open": () => dataBool(state.isOpen()),
      "data-disabled": selectDisabledAttr(state),
      "data-invalid": () => dataBool(isInvalid()),
      "data-required": selectRequiredAttr(state),
      onFocusIn: (event: FocusEvent & { currentTarget: HTMLElement }) => selectFocusWithin(state, event),
      onFocusOut: (event: FocusEvent & { currentTarget: HTMLElement }) => selectFocusWithin(state, event),
      onKeyDownCapture: (event: KeyboardEvent) => selectTriggerKeyDownCapture(state, event),
      children: () => [rp.children(), <HiddenSelect state={state} autoComplete={autoComplete} preloadVisible />],
    };
    return (
      <Provider values={values}>
        {props.render(attrs as never, {
          isOpen: () => state.isOpen(),
          isFocused: () => state.isFocused(),
          isFocusVisible: () => state.isFocused() && state.isFocusVisible(),
          isDisabled: () => isSelectDisabled(state),
          isInvalid,
          isRequired: () => isSelectRequired(state),
        })}
      </Provider>
    );
  }
  return (
    <Provider values={values}>
      <div
        {...dom}
        ref={ref as never}
        class={rp.class()}
        style={rp.style()}
        slot={slot}
        data-focused={dataBool(state.isFocused())}
        data-focus-visible={dataBool(state.isFocused() && state.isFocusVisible())}
        data-open={dataBool(state.isOpen())}
        data-disabled={dataBool(isSelectDisabled(state))}
        data-invalid={dataBool(isInvalid())}
        data-required={dataBool(isSelectRequired(state))}
        preload="visible"
        onFocusIn={(event) => selectFocusWithin(state, event)}
        onFocusOut={(event) => selectFocusWithin(state, event)}
        onKeyDownCapture={(event) => selectTriggerKeyDownCapture(state, event)}
      >
        {rp.children()}
        <HiddenSelect state={state} autoComplete={autoComplete} />
      </div>
    </Provider>
  );
}

/** RAC `SelectContext` value type of the parts form (re-exported for typing slots). */
export type SelectPartsContextValue = ContextValue<SelectPartsProps<SelectionMode>, HTMLDivElement>;
