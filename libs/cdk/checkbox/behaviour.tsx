// Ported from react-aria `useToggle`, `useCheckbox`, `useCheckboxGroup`, `useCheckboxGroupItem`
// (packages/react-aria/src/toggle/useToggle.ts, src/checkbox/useCheckbox.ts, useCheckboxGroup.ts,
// useCheckboxGroupItem.ts, utils.ts), Apache-2.0, © Adobe.
// Rivet:
// - RA hooks → `toggleProps(props, state, inputRef?)`, `checkboxProps` (`switchProps`: ../switch/behaviour.tsx), `checkboxGroupProps(props, state)`,
//   `checkboxGroupItemProps(props, groupState, inputRef?)`; bags keep RA's keys. Values that change are
//   accessors (`checked`, `aria-invalid`, `aria-describedby`, `disabled`, `indeterminate`…): spread the bags,
//   the runtime spread reads them in bindings. Result flags are accessors (`isSelected()`, `isPressed()`…).
// - RA handlers → free functions `toggle<Event>(event, props, ctx)` (`toggleChange`, `toggleInvalid`,
//   `toggleFocus`); the label press handlers come from `pressProps` (RA usePress) like upstream.
// - No layout effect before interaction: the native custom validity is synced from the input's handlers
//   (change / focus / invalid) and by `<Form>` submit from `data-rv-error` (see form/behaviour.ts); the form
//   reset listener attaches from the first handler that sees the input (RA `useFormReset`).
// - `checkboxGroupData` (RA module WeakMap) → the group state's `data` field (serializes with the state).
// - `.tsx` (no JSX): the bags hold closures a resumed binding / context captures.
// Deviations: a read-only checkbox's native `checked` is restored after the browser toggled it (RA re-renders
// the controlled input); group native validation is applied to every checkbox of the group at once.
import { signal, untrack } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { DEV, devWhere } from "#dev";
import { createToggleState, isToggleReadOnly, isToggleSelected, setSelected, toggle, type ToggleState, type ToggleStateOptions } from "../state/toggle.ts";
import {
  DEFAULT_VALIDATION_RESULT,
  clearServerErrors,
  commitValidation,
  createFormValidationState,
  displayValidation,
  mergeValidation,
  read,
  realtimeValidation,
  updateValidation,
  type FormValidationState,
  type MaybeAccessor,
  type ValidationBehavior,
  type ValidationErrors,
  type ValidationFunction,
  type ValidationResult,
} from "../state/form-validation.ts";
import { addValue, isCheckboxGroupRequired, isRequiredNow, removeValue, setInvalid, setValue, type CheckboxGroupState } from "../state/checkbox-group.ts";
import { commit, nativeValidity, onFormReset, syncValidity, validationInvalid, validityError } from "../form/behaviour.ts";
import { focusableProps } from "../focus/focusable.tsx";
import { pressProps, type PressEvent, type PressEvents } from "../interactions/press.tsx";
import { mergeDefined, mergeProps } from "../interactions/merge-props.tsx";
import { fieldProps } from "../label/behaviour.ts";
import { focusWithinProps } from "../interactions/focus.tsx";
import { createSlotId, slotIdRef, type SlotId } from "../slots/index.tsx";

export type PropBag = Record<string, unknown>;
/** The input element ref (`ref()` from `@rivetjs/runtime/dom`). */
export type InputRef = Ref<HTMLInputElement>;

/** RA `AriaToggleProps` (+ `ToggleProps`, `InputDOMProps`, `AriaValidationProps`, `PressEvents`, `FocusableProps`). */
export interface AriaToggleProps extends ToggleStateOptions, PressEvents {
  /** The label content (RA: whether there is one; only its presence matters). */
  children?: unknown;
  /** The value of the input element, used when submitting an HTML form. Read once at mount (a group's item key). */
  value?: string;
  /** The name of the input element, used when submitting an HTML form. Read once at mount (form identity). */
  name?: string;
  /** The `<form>` element to associate the input with. Read once at mount (form identity). */
  form?: string;
  /** Whether the input is disabled (a value, or an accessor that stays live). */
  isDisabled?: boolean | (() => boolean | undefined);
  /** Whether the input is read-only (a value, or an accessor that stays live). */
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  /** Whether the input is required (a value, or an accessor that stays live). */
  isRequired?: MaybeAccessor<boolean | undefined>;
  /** Whether the input value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  validate?: ValidationFunction<boolean>;
  /** @default 'aria' (RA hook default; RAC components pass "native" or the Form's) */
  validationBehavior?: ValidationBehavior;
  /** Server errors (RAC: the enclosing `<Form>`'s `FormValidationContext`). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined>;
  id?: string;
  autoFocus?: boolean;
  excludeFromTabOrder?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
  /** Identifies the element (or elements) whose contents or presence are controlled by the current element. */
  "aria-controls"?: string;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  onKeyUp?: (e: KeyboardEvent) => void;
}

/** RA `AriaCheckboxProps`. */
export interface AriaCheckboxProps extends AriaToggleProps {
  /** Indeterminism is presentational only (a value, or an accessor that stays live). */
  isIndeterminate?: MaybeAccessor<boolean | undefined>;
}

/** RA `ToggleAria` / `CheckboxAria` / `SwitchAria`. */
export interface ToggleAria {
  /** Props for the label wrapper element. */
  labelProps: PropBag;
  /** Props for the input element. */
  inputProps: PropBag;
  /** Props for the description element, if any (`id` is a slot id: provide it through `TextContext`). */
  descriptionProps: { id: SlotId };
  /** Props for the error message element, if any (slot id). */
  errorMessageProps: { id: SlotId };
  isSelected: () => boolean;
  isPressed: () => boolean;
  isDisabled: () => boolean;
  isReadOnly: () => boolean;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
  /** Rivet: the toggle state the bags read. */
  state: ToggleState;
  /** Rivet: the input ref the bags set (focused on label press). */
  inputRef: InputRef;
}

/**
 * RA `privateValidationStateProp`: the validation a group item reports to (the group's), instead of its own.
 * @internal
 */
export interface ItemValidation {
  group: CheckboxGroupState;
  value: string;
  /** The item's own validation (behaviour "aria": realtime only). */
  own: FormValidationState;
  behavior: ValidationBehavior;
}

/**
 * One input ref from the component's own ref and the user's (`inputRef` prop, context `inputRef`): a
 * callback ref for the element that is also readable (`ref()` → the element), like RA `useObjectRef(mergeRefs(…))`.
 */
export function mergeInputRefs(
  ...refs: (InputRef | ((el: HTMLInputElement | null) => unknown) | { current: HTMLInputElement | null } | undefined)[]
): InputRef {
  const own = createRef<HTMLInputElement>();
  const targets = refs.filter((r) => r != null);
  if (!targets.length) return own;
  const merged = (...args: [HTMLInputElement | null]) => {
    if (!args.length) return own();
    const el = args[0];
    (own as unknown as { set(v: HTMLInputElement | undefined): void }).set(el ?? undefined);
    for (const target of targets) {
      if (typeof target === "function") {
        const signalRef = target as { set?: (value: HTMLInputElement | undefined) => void };
        if (signalRef.set) signalRef.set(el ?? undefined);
        else (target as (el: HTMLInputElement | null) => unknown)(el);
      } else target.current = el;
    }
  };
  return merged as unknown as InputRef;
}

/** What the input handlers act on. */
export interface ToggleContext {
  state: ToggleState;
  validation: FormValidationState;
  item?: ItemValidation;
}

/** RA `useToggle`. */
export function toggleProps(props: AriaToggleProps, state: ToggleState, inputRef: InputRef = createRef<HTMLInputElement>(), item?: ItemValidation): ToggleAria {
  const { value, name, form, isRequired, validationBehavior = "aria", onPressStart, onPressEnd, onPressChange, onPress, onPressUp, onClick } = props;
  const isDisabledProp = props.isDisabled;
  // May be accessors (live props P5: `liveOptions` at the part boundary): read at use.
  const isReadOnlyProp = props.isReadOnly as MaybeAccessor<boolean | undefined>;
  const readOnly = () => !!read(isReadOnlyProp);
  const ariaDescribedby = props["aria-describedby"] as MaybeAccessor<string | undefined>;

  // Create validation state here because it doesn't make sense to add to general useToggleState.
  const validation = createFormValidationState({ ...props, validationBehavior, value: state.selected });
  const display = (): ValidationResult => (item ? itemDisplay(item) : displayValidation(validation));
  const isInvalid = () => display().isInvalid;
  const isDisabled = () => !!read(isDisabledProp);
  const ctx: ToggleContext = { state, validation, item };

  if (props.children == null && props["aria-label"] == null && props["aria-labelledby"] == null && DEV)
    console.warn("[rivet:cdk] checkbox: If you do not provide children, you must specify an aria-label for accessibility" + devWhere());

  // Handle press state for keyboard interactions and cases where labelProps is not used.
  const { pressProps: inputPressProps, isPressed: inputPressed } = pressProps({
    onPressStart,
    onPressEnd,
    onPressChange,
    onPress,
    onPressUp,
    onClick,
    isDisabled,
  });

  // Handle press state on the label.
  const labelPressed = signal(false);
  const labelPress = pressProps({
    onPressStart: (e: PressEvent) => {
      // Keyboard interactions are handled directly on the input.
      if (e.pointerType === "keyboard" || e.pointerType === "virtual") return e.continuePropagation();
      onPressStart?.(e);
      onPressChange?.(true);
      labelPressed.set(true);
    },
    onPressEnd: (e: PressEvent) => {
      if (e.pointerType === "keyboard" || e.pointerType === "virtual") return e.continuePropagation();
      onPressEnd?.(e);
      onPressChange?.(false);
      labelPressed.set(false);
    },
    onPressUp: (e: PressEvent) => {
      if (e.pointerType === "keyboard" || e.pointerType === "virtual") return e.continuePropagation();
      onPressUp?.(e);
    },
    onClick,
    onPress: (e: PressEvent) => {
      if (e.pointerType === "keyboard" || e.pointerType === "virtual") return e.continuePropagation();
      onPress?.(e);
      toggleLabelPress(ctx, inputRef);
    },
    isDisabled: () => isDisabled() || readOnly(),
  });

  const focusable = focusableProps({ ...props, isDisabled: untrack(isDisabled) } as never, inputRef);

  // Copied from useField because we don't want the label behavior that provides.
  // With an explicit `id`, the part ids derive from it (byte-stable HTML, like `fieldProps`).
  const descriptionId = createSlotId(props.id ? props.id + "-description" : undefined);
  const errorMessageId = createSlotId(props.id ? props.id + "-error" : undefined, isInvalid);

  // RA `mergeProps(domProps, {…}, mergeProps(pressProps, focusableProps))` in one pass (same result: the first two
  // bags share no key, and mergeProps is associative). `mergeDefined`: the literal is merged into in place, and the
  // static result drops its unset entries (same attributes; the spread / merges downstream walk only set keys).
  const inputProps: PropBag = mergeDefined(
    {
      id: props.id,
      "aria-label": props["aria-label"],
      "aria-labelledby": props["aria-labelledby"],
      "aria-details": props["aria-details"],
      tabIndex: props.excludeFromTabOrder ? -1 : undefined,
      ref: inputRef,
      checked: () => state.selected(),
      "aria-required": requiredAttr(isRequired, validationBehavior === "aria"),
      required: requiredAttr(isRequired, validationBehavior === "native"),
      "aria-invalid": () => isInvalid() || undefined,
      "aria-errormessage": props["aria-errormessage"],
      "aria-controls": props["aria-controls"],
      "aria-readonly": () => readOnly() || undefined,
      "aria-describedby": () =>
        // Server: the field's slot probe (`CheckboxField`) marked the parts that render; a lone Checkbox has none.
        [slotIdRef(descriptionId, false), slotIdRef(errorMessageId, isInvalid()), read(ariaDescribedby)].filter(Boolean).join(" ") || undefined,
      onChange: (e: Event) => toggleChange(e, {}, ctx),
      onInvalid: (e: Event) => toggleInvalid(e, {}, ctx),
      // Delegated focusin (the input's own focus).
      onFocusIn: (e: FocusEvent) => (e.target === e.currentTarget ? toggleFocus(e, {}, ctx) : undefined),
      disabled: () => isDisabled() || undefined,
      value,
      name,
      form,
      type: "checkbox",
      // Rivet: the realtime error for `<Form>`'s cold submit (fields never interacted with).
      "data-rv-error": () => (item ? undefined : validityError(validation)),
    },
    inputPressProps,
    focusable,
  );

  return {
    labelProps: mergeProps(labelPress.pressProps, { onClick: (e: MouseEvent) => e.preventDefault() }),
    inputProps,
    descriptionProps: { id: descriptionId },
    errorMessageProps: { id: errorMessageId },
    isSelected: () => state.selected(),
    isPressed: () => inputPressed() || labelPressed(),
    isDisabled,
    isReadOnly: readOnly,
    isInvalid,
    validationErrors: () => display().validationErrors,
    validationDetails: () => display().validationDetails,
    state,
    inputRef,
  };
}

/** RA `useCheckbox`: `toggleProps` + the label `onMouseDown` (keep focus off the label) + `indeterminate`. */
export function checkboxProps(props: AriaCheckboxProps, state: ToggleState, inputRef?: InputRef, item?: ItemValidation): ToggleAria {
  const res = toggleProps(props, state, inputRef, item);
  // indeterminate is a property, but it can only be set via javascript: the component binds
  // `prop:indeterminate={read(props.isIndeterminate)}` on the input (RA: an effect).
  return {
    ...res,
    labelProps: mergeProps(res.labelProps, {
      // Prevent label from being focused when mouse down on it.
      // Note, this does not prevent the input from being focused in the `click` event.
      onMouseDown: (e: MouseEvent) => e.preventDefault(),
    }),
  };
}

/** RA `checkboxGroupData` entry: kept on the group state (`state.data`). */
export interface CheckboxGroupData {
  name?: string;
  form?: string;
  descriptionId?: SlotId;
  errorMessageId?: SlotId;
  validationBehavior: ValidationBehavior;
}

/** RA `AriaCheckboxGroupProps`. */
export interface AriaCheckboxGroupProps {
  /** Whether a visible label renders (RA `label`: any truthy content). */
  label?: unknown;
  /** A value, or an accessor that stays live (live props). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  isReadOnly?: MaybeAccessor<boolean | undefined>;
  isRequired?: MaybeAccessor<boolean | undefined>;
  name?: string;
  form?: string;
  /** @default 'aria' */
  validationBehavior?: ValidationBehavior;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  onFocus?: (e: FocusEvent) => void;
  onBlur?: (e: FocusEvent) => void;
  onFocusChange?: (isFocused: boolean) => void;
}

export interface CheckboxGroupAria {
  groupProps: PropBag;
  labelProps: PropBag;
  descriptionProps: { id: SlotId };
  errorMessageProps: { id: SlotId };
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
}

/** RA `useCheckboxGroup`. */
export function checkboxGroupProps(props: AriaCheckboxGroupProps, state: CheckboxGroupState): CheckboxGroupAria {
  const { isDisabled, name, form, validationBehavior = "aria" } = props;
  const display = () => displayValidation(state.validation);
  const isInvalid = () => display().isInvalid;
  // Checkbox group is not an HTML input element so it shouldn't be labeled by a <label> element.
  const ids = fieldProps({ ...props, labelElementType: "span" });
  const descriptionId = createSlotId(props.id ? props.id + "-description" : undefined);
  const errorMessageId = createSlotId(ids.errorMessageId, isInvalid);
  state.data = { name, form, descriptionId, errorMessageId, validationBehavior };
  const describedBy = props["aria-describedby"];
  const { onBlur, onFocus, onFocusChange } = props;
  const focusWithin = focusWithinProps({ onBlurWithin: onBlur, onFocusWithin: onFocus, onFocusWithinChange: onFocusChange });
  // RA filterDOMProps(props, { labelable: true }): `data-*` attributes (id / aria-* come from fieldProps).
  const dataAttrs: PropBag = {};
  for (const key in props) if (key.startsWith("data-")) dataAttrs[key] = (props as Record<string, unknown>)[key];
  return {
    groupProps: mergeProps(
      dataAttrs,
      {
        role: "group",
        "aria-disabled": typeof isDisabled === "function" ? trueWhen(isDisabled) : isDisabled || undefined,
        ...ids.fieldProps,
        "aria-details": props["aria-details"],
        "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorMessageId, isInvalid()), describedBy].filter(Boolean).join(" ") || undefined,
      },
      focusWithin.focusWithinProps,
    ),
    labelProps: { ...ids.labelProps },
    descriptionProps: { id: descriptionId },
    errorMessageProps: { id: errorMessageId },
    isInvalid,
    validationErrors: () => display().validationErrors,
    validationDetails: () => display().validationDetails,
  };
}

/** RA `AriaCheckboxGroupItemProps`. */
export interface AriaCheckboxGroupItemProps extends Omit<AriaCheckboxProps, "isSelected" | "defaultSelected"> {
  value: string;
}

/** RA `useCheckboxGroupItem`. */
export function checkboxGroupItemProps(props: AriaCheckboxGroupItemProps, state: CheckboxGroupState, inputRef?: InputRef): ToggleAria {
  const itemValue = props.value;
  const userOnChange = props.onChange;
  const selected = () => state.value().includes(itemValue);
  // Live props: the item's and the group's `isReadOnly` / `isDisabled` / `isRequired` stay live when either is an
  // accessor (static path: the creation values, as before).
  const isReadOnly = itemFlag(props.isReadOnly, state.isReadOnly, state.readOnly);
  const toggleState = createToggleState({
    isReadOnly,
    isSelected: selected,
    defaultSelected: state.defaultValue.includes(itemValue),
    onChange: (isSelected: boolean) => {
      if (isSelected) addValue(state, itemValue);
      else removeValue(state, itemValue);
      if (userOnChange) userOnChange(isSelected);
    },
  });
  const data = state.data ?? { validationBehavior: "aria" as ValidationBehavior };
  const validationBehavior = props.validationBehavior ?? data.validationBehavior;
  // Local validation for this checkbox (server validation is handled at the group level).
  const own = createFormValidationState({ ...props, value: selected, name: undefined, validationBehavior: "aria" });
  const item: ItemValidation = { group: state, value: itemValue, own, behavior: validationBehavior };
  const res = checkboxProps(
    {
      ...props,
      isReadOnly,
      isDisabled: itemFlag(props.isDisabled, state.isDisabled, state.disabled),
      name: props.name || data.name,
      form: props.form || data.form,
      isRequired: state.requiredNow ? groupRequired(props.isRequired, state) : (props.isRequired ?? state.required),
      validationBehavior,
    },
    toggleState,
    inputRef,
    item,
  );
  // RA: `isRequired: props.isRequired ?? state.isRequired` (the group's is live: required while nothing is selected).
  const native = validationBehavior === "native";
  const ownRequired = props.isRequired;
  const own_ = res.inputProps["aria-describedby"] as () => string | undefined;
  const groupInvalid = () => displayValidation(state.validation).isInvalid;
  return {
    ...res,
    inputProps: {
      ...res.inputProps,
      // Native `required`: the item's own `isRequired`, else the group's (required while nothing is selected).
      // One arrow (a conditional around a closure is not resumable).
      required: () => (native && (read(ownRequired) ?? isRequiredNow(state))) || undefined,
      "aria-describedby": () =>
        [own_(), groupInvalid() ? slotIdRef(data.errorMessageId) : null, slotIdRef(data.descriptionId, false)].filter(Boolean).join(" ") || undefined,
    },
  };
}

/** An item flag (RA `props.x || state.x`): the static value, or a returned accessor while the item's or the group's flag
 *  is live (returned arrows: resumable). */
function itemFlag(own: MaybeAccessor<boolean | undefined>, group: boolean, live: (() => boolean | undefined) | undefined): MaybeAccessor<boolean | undefined> {
  if (!live && typeof own !== "function") return group ? true : own;
  return flagEither(own, group, live);
}
function flagEither(own: MaybeAccessor<boolean | undefined>, group: boolean, live: (() => boolean | undefined) | undefined): () => boolean {
  return () => !!(live ? live() : group) || !!read(own);
}
/** RA `props.isRequired ?? state.isRequired` with a live group `isRequired`. */
function groupRequired(own: MaybeAccessor<boolean | undefined>, state: CheckboxGroupState): () => boolean {
  return () => {
    const mine = read(own);
    return mine ?? isCheckboxGroupRequired(state);
  };
}
/** `true | undefined` of a live flag (a returned arrow: resumable). */
function trueWhen(flag: () => boolean | undefined): () => true | undefined {
  return () => !!flag() || undefined;
}
/** A required attribute (`aria-required` / `required`): the static value, or an accessor while `isRequired` is live. */
function requiredAttr(isRequired: MaybeAccessor<boolean | undefined>, applies: boolean): MaybeAccessor<true | undefined> {
  if (!applies) return undefined;
  return typeof isRequired === "function" ? trueWhen(isRequired) : isRequired || undefined;
}

/** Combined group + item validation shown by a group item (RA `combinedRealtimeValidation` / `displayValidation`). */
function itemDisplay(item: ItemValidation): ValidationResult {
  const groupRealtime = realtimeValidation(item.group.validation);
  const combined = groupRealtime.isInvalid ? groupRealtime : realtimeValidation(item.own);
  return item.behavior === "native" ? displayValidation(item.group.validation) : combined;
}

/** Report the item's own realtime validation (or its native validity) to the group (RA `updateValidation` effect). */
function reportItem(item: ItemValidation, native: ValidationResult = DEFAULT_VALIDATION_RESULT): void {
  const realtime = untrack(() => realtimeValidation(item.own));
  setInvalid(item.group, item.value, realtime.isInvalid ? realtime : native);
}

/** Label press (mouse / touch): toggle, focus the input, commit validation (RA `useToggle` label `onPress`). */
export function toggleLabelPress(ctx: ToggleContext, inputRef: InputRef): void {
  const { state } = ctx;
  if (isToggleReadOnly(state)) return;
  toggle(state);
  const input = inputRef();
  // The `checked` binding may not have flushed yet: the native validity below reads the element.
  if (input) input.checked = isToggleSelected(state);
  input?.focus();
  afterToggle(ctx, input);
}

function afterToggle(ctx: ToggleContext, input: HTMLInputElement | undefined | null): void {
  const { item, validation } = ctx;
  if (item) {
    reportItem(item);
    clearServerErrors(item.group.validation);
    if (input) syncGroupValidity(item.group, input, item.behavior);
    commitValidation(item.group.validation);
  } else commit(validation, input);
}

/** `change` on the input (RA `onChange`: `setSelected(checked)`; useFormValidation commits). */
export function toggleChange(event: Event, _props: object, ctx: ToggleContext): void {
  const input = event.currentTarget as HTMLInputElement;
  // since we spread props on label, onChange will end up there as well as in here.
  // so we have to stop propagation at the lowest level that we care about
  event.stopPropagation();
  attachReset(ctx, input);
  const { state } = ctx;
  if (isToggleReadOnly(state)) {
    // Read-only: the native control toggled; keep it in sync with the state (RA is controlled).
    input.checked = isToggleSelected(state);
    return;
  }
  setSelected(state, input.checked);
  // A controlled value that did not change keeps the native control in sync (RA re-renders).
  if (state.controlled.isControlled && !state.controlled.isSignal) queueMicrotask(() => (input.checked = untrack(state.selected)));
  afterToggle(ctx, input);
}

/** `focus` on the input: sync the custom validity (server / validate errors) before a submit. */
export function toggleFocus(event: FocusEvent, _props: object, ctx: ToggleContext): void {
  const input = event.currentTarget as HTMLInputElement;
  attachReset(ctx, input);
  if (ctx.item) syncGroupValidity(ctx.item.group, input, ctx.item.behavior);
  else syncValidity(ctx.validation, input);
}

/** `invalid` on the input (RA useFormValidation `onInvalid`). */
export function toggleInvalid(event: Event, _props: object, ctx: ToggleContext): void {
  const input = event.currentTarget as HTMLInputElement;
  if (ctx.item) {
    syncGroupValidity(ctx.item.group, input, ctx.item.behavior);
    validationInvalid(ctx.item.group.validation, event);
  } else validationInvalid(ctx.validation, event);
}

function attachReset(ctx: ToggleContext, input: HTMLInputElement): void {
  const { state, item } = ctx;
  if (item) onFormReset(item.group, input, () => setValue(item.group, [...item.group.defaultValue]));
  else onFormReset(state, input, () => setSelected(state, state.defaultSelected));
}

/** Inputs of the group the checkbox belongs to. */
const groupInputs = (input: HTMLInputElement): HTMLInputElement[] => {
  const group = input.closest('[role="group"]');
  return group ? [...group.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')] : [input];
};

/**
 * Native group validation (RA useCheckboxGroupItem → useFormValidation layout effect with the group's
 * validation): the group's realtime error is the custom validity of every checkbox; native validities
 * (required) merge into the group's next result.
 */
export function syncGroupValidity(group: CheckboxGroupState, input: HTMLInputElement, behavior = group.validation.behavior): void {
  const { validation } = group;
  // RA: the item's own `validationBehavior` decides (useFormValidation runs per checkbox input).
  if (behavior !== "native") return;
  const realtime = untrack(() => realtimeValidation(validation));
  const message = realtime.isInvalid ? realtime.validationErrors.join(" ") || "Invalid value." : "";
  const inputs = groupInputs(input);
  // The `required` binding may not have flushed yet: apply it before reading native validity.
  const required = untrack(() => isRequiredNow(group));
  for (const el of inputs) {
    if (el.disabled) continue;
    if (isCheckboxGroupRequired(group)) el.required = required;
    el.setCustomValidity(message);
    if (!el.hasAttribute("title")) el.title = "";
  }
  if (!realtime.isInvalid) {
    const invalid = inputs.filter((el) => !el.disabled && !el.validity.valid).map(nativeValidity);
    updateValidation(validation, invalid.length ? mergeValidation(...invalid) : DEFAULT_VALIDATION_RESULT);
  }
}

export { createToggleState };
