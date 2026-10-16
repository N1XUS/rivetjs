// Ported from react-aria `useTextField`, `useFormattedTextField` (packages/react-aria/src/textfield/useTextField.ts,
// useFormattedTextField.ts) + `useFormReset` (src/utils/useFormReset.ts), Apache-2.0, © Adobe.
// Rivet:
// - RA `useTextField(props, ref)` → `textFieldProps(props, inputRef?, state?)`; the state
//   (`createTextFieldState`: RA's `useControlledState` + `useFormValidationState`) is created from the
//   props unless passed (plain signals + JSON: it serializes). `textFieldProps` creates the label / description / error ids (call it once while rendering, not
//   inside a binding). Bags keep RA's keys; values that change are accessors (`value`, `aria-invalid`,
//   `aria-describedby`, …): bind them (`aria-invalid={inputProps["aria-invalid"]()}`) or spread the bag
//   (`<input {...inputProps} />`: the runtime spread calls function-valued non-`on*` / non-`ref` keys).
// - `.tsx` (no JSX): the bags hold closures a resumed binding / context captures; only `.tsx` modules
//   are resume-compiled. Pure helpers (`errorText`, `fieldDescribedBy`, `isInvalid`) live in `fields.ts`.
// - RA handlers → free functions `textField<Event>(event, props, state)`: `textFieldInput` (React
//   `onChange` = native `input`), `textFieldChange` (native `change`: commit), `textFieldInvalid`,
//   `textFieldFocus`. No layout effect runs before interaction: the native custom validity is synced
//   from these handlers (+ `<Form>` submit, `form/behaviour.ts`); the form reset listener attaches on
//   the first handler that sees the input.
// - `useFormattedTextField(props, state, ref)` → `formattedTextFieldProps(props, state, inputRef?, textState?)`:
//   the native `beforeinput` handler is bound as `onBeforeInput` (Chrome / Safari / Firefox ≥ 87 all fire
//   it natively); the non-native fallback branch is the same handler (`InputEvent.data`).
import { untrack } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { setInteractionModality } from "../interactions/focus-visible.tsx";
import { focusBlur, focusFocus } from "../interactions/focus.tsx";
import { getEventTarget } from "../interactions/utils.ts";
import {
  createFormValidationState,
  displayValidation,
  type FormValidationState,
  type MaybeAccessor,
  type ValidationBehavior,
  type ValidationErrors,
  type ValidationFunction,
  type ValidationResult,
} from "../state/form-validation.ts";
import { onFormReset, syncValidity, validationChange, validationInvalid, validityError } from "../form/behaviour.ts";
import { describedBy, fieldProps, type FieldIds } from "../label/behaviour.ts";
export { errorText, fieldDescribedBy, isInvalid, type HasValidation, type ErrorMessage } from "./fields.ts";
import type { Signal } from "@rivetjs/reactivity";

/** RA `AriaTextFieldProps` (+ `AriaTextFieldOptions`). Events are native DOM events. */
export interface AriaTextFieldProps {
  /** The current value (controlled): a plain value or a two-way Signal. */
  value?: string | Signal<string> | undefined;
  /** The initial value (uncontrolled). Read once at mount. */
  defaultValue?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  /** Whether a visible label renders (RA `label`: any truthy content). */
  label?: unknown | undefined;
  description?: unknown | undefined;
  errorMessage?: unknown | undefined;
  isDisabled?: boolean | undefined;
  isReadOnly?: boolean | undefined;
  /** A value, or an accessor that stays live (live props). */
  isRequired?: MaybeAccessor<boolean | undefined> | undefined;
  isInvalid?: MaybeAccessor<boolean | undefined> | undefined;
  /** @deprecated RA legacy prop; use `isInvalid`. */
  validationState?: "valid" | "invalid" | undefined;
  validate?: ValidationFunction<string> | undefined;
  /** @default "aria" (RA hook default; RAC components pass "native" or the Form's). Read once at mount. */
  validationBehavior?: ValidationBehavior | undefined;
  /** Server errors (RAC: the enclosing `<Form>`'s `FormValidationContext`). */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined> | undefined;
  /** `input` (default) or `textarea`: `type` / `pattern` only on inputs. Read once at mount (element choice). */
  inputElementType?: "input" | "textarea" | undefined;
  type?: string | undefined;
  pattern?: string | undefined;
  /** The name of the input, submitted with an HTML form. Read once at mount (form / validation identity). */
  name?: string | undefined;
  form?: string | undefined;
  placeholder?: string | undefined;
  autoComplete?: string | undefined;
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters" | undefined;
  autoCorrect?: string | undefined;
  spellCheck?: boolean | "true" | "false" | undefined;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search" | undefined;
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send" | undefined;
  maxLength?: number | undefined;
  minLength?: number | undefined;
  /** Whether the input takes focus when it mounts. Read once at mount (acts at mount only). */
  autoFocus?: boolean | undefined;
  excludeFromTabOrder?: boolean | undefined;
  /** The input id (description / error ids derive from it). Read once at mount. */
  id?: string | undefined;
  /** Read once at mount (combined with the label's id into `aria-labelledby` by `fieldProps`). */
  "aria-label"?: string;
  /** Read once at mount (combined with the label's id by `fieldProps`). */
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  "aria-errormessage"?: string;
  "aria-activedescendant"?: string;
  "aria-autocomplete"?: "none" | "inline" | "list" | "both";
  "aria-haspopup"?: boolean | "false" | "true" | "menu" | "listbox" | "tree" | "grid" | "dialog";
  "aria-controls"?: string;
  onFocus?: ((e: FocusEvent) => void) | undefined;
  onBlur?: ((e: FocusEvent) => void) | undefined;
  onFocusChange?: ((isFocused: boolean) => void) | undefined;
  onKeyDown?: ((e: KeyboardEvent) => void) | undefined;
  onKeyUp?: ((e: KeyboardEvent) => void) | undefined;
  /** Text input DOM events (RA `TextInputDOMProps`). */
  onCopy?: ((e: ClipboardEvent) => void) | undefined;
  onCut?: ((e: ClipboardEvent) => void) | undefined;
  onPaste?: ((e: ClipboardEvent) => void) | undefined;
  onCompositionStart?: ((e: CompositionEvent) => void) | undefined;
  onCompositionEnd?: ((e: CompositionEvent) => void) | undefined;
  onCompositionUpdate?: ((e: CompositionEvent) => void) | undefined;
  onSelect?: ((e: Event) => void) | undefined;
  onBeforeInput?: ((e: InputEvent) => void) | undefined;
  onInput?: ((e: Event) => void) | undefined;
}

export interface TextFieldState {
  /** The text (RA `useControlledState(value, defaultValue, onChange)`). */
  readonly value: ControlledState<string>;
  /** Value restored on form reset (RA `useFormReset`: `defaultValue ?? initial value`). */
  readonly initial: string;
  readonly validation: FormValidationState;
}

export type TextFieldStateOptions = Pick<
  AriaTextFieldProps,
  "value" | "defaultValue" | "onChange" | "isInvalid" | "validationState" | "validate" | "validationBehavior" | "name" | "validationErrors"
>;

/** RA `useTextField` state: controlled text + form validation (signals + JSON). */
export function createTextFieldState(options: TextFieldStateOptions): TextFieldState {
  const value = controllable<string>(options.value, options.defaultValue || "", options.onChange);
  const read = () => value.value();
  return {
    value,
    initial: options.defaultValue ?? untrack(read),
    validation: createFormValidationState({
      isInvalid: options.isInvalid,
      validationState: options.validationState,
      validate: options.validate,
      validationBehavior: options.validationBehavior ?? "aria",
      name: options.name,
      validationErrors: options.validationErrors,
      value: read,
    }),
  };
}

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

/** Element attributes: plain values, accessors (`() => v`, changing values) and `on*` handlers. */
export type PropBag = Record<string, unknown>;

export interface TextFieldAria {
  labelProps: PropBag;
  inputProps: PropBag;
  descriptionProps: PropBag;
  errorMessageProps: PropBag;
  /** Ids of the field parts (Rivet: for RAC Label / Text / FieldError slots). */
  ids: FieldIds;
  /** Rivet: the field state (value + validation) the bags read. */
  state: TextFieldState;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
}

/** Element ref (`ref()` from `@rivetjs/runtime/dom`, or a callback): set as the input bag's `ref`. */
export type InputRef = ((el: HTMLInputElement | HTMLTextAreaElement | null) => unknown) | undefined;

/**
 * RA `useTextField(props, ref)`: label, input, description and error message props of a text field.
 * Rivet: the state (controlled value + validation) is created from `props` unless passed (components
 * create it first: `textFieldProps(props, inputRef, createTextFieldState(…))`); it is returned as `state`.
 */
export function textFieldProps(props: AriaTextFieldProps, inputRef?: InputRef, state: TextFieldState = createTextFieldState(props)): TextFieldAria {
  const { inputElementType = "input", isDisabled = false, isRequired = false, isReadOnly = false, type = "text" } = props;
  const { onInput, onFocus, onBlur, onFocusChange } = props;
  const behaviour = state.validation.behavior;
  const ids = fieldProps(props);
  const isInvalid = () => displayValidation(state.validation).isInvalid;
  const hasErrorMessage = () => isInvalid();
  const inputOnly: PropBag = inputElementType === "input" ? { type, pattern: props.pattern } : {};
  const inputProps: PropBag = {
    ...inputOnly,
    ref: inputRef,
    id: ids.fieldProps.id,
    disabled: isDisabled || undefined,
    readOnly: isReadOnly || undefined,
    required: typeof isRequired === "function" ? requiredWhen(isRequired, behaviour === "native") : (isRequired && behaviour === "native") || undefined,
    "aria-required": typeof isRequired === "function" ? requiredWhen(isRequired, behaviour === "aria") : (isRequired && behaviour === "aria") || undefined,
    "aria-invalid": () => isInvalid() || undefined,
    "aria-errormessage": props["aria-errormessage"],
    "aria-activedescendant": props["aria-activedescendant"],
    "aria-autocomplete": props["aria-autocomplete"],
    "aria-haspopup": haspopupAttr(props["aria-haspopup"]),
    "aria-controls": props["aria-controls"],
    "aria-label": ids.fieldProps["aria-label"],
    "aria-labelledby": ids.fieldProps["aria-labelledby"],
    "aria-describedby": () => describedBy(ids, hasErrorMessage()),
    "aria-details": props["aria-details"],
    // Native mode: the realtime error, applied as custom validity by a cold `<Form>` submit (form/behaviour.ts).
    "data-rv-error": () => validityError(state.validation),
    value: () => state.value.value(),
    autoComplete: props.autoComplete,
    autoCapitalize: props.autoCapitalize,
    maxLength: props.maxLength,
    minLength: props.minLength,
    name: props.name,
    form: props.form,
    placeholder: props.placeholder,
    inputMode: props.inputMode,
    autoCorrect: props.autoCorrect,
    spellCheck: props.spellCheck,
    enterKeyHint: props.enterKeyHint,
    autoFocus: props.autoFocus,
    tabIndex: tabIndexAttr(props.excludeFromTabOrder),
    onCopy: props.onCopy,
    onCut: props.onCut,
    onPaste: props.onPaste,
    onCompositionEnd: props.onCompositionEnd,
    onCompositionStart: props.onCompositionStart,
    onCompositionUpdate: props.onCompositionUpdate,
    onSelect: props.onSelect,
    onBeforeInput: props.onBeforeInput,
    // Handlers capture only the callbacks they call (a resumed handler serializes its captures).
    onInput: (e: Event) => textFieldInput(e, { onInput }, state),
    onChange: (e: Event) => textFieldChange(e, {}, state),
    onInvalid: (e: Event) => textFieldInvalid(e, {}, state),
    // Validity sync on the delegated focusin (no listener). The user callbacks bind natively, only when given, so
    // a handler merged after this bag (`<Input onFocus>`: RAC useContextProps) runs after them, as in React Aria.
    onFocusIn: (e: FocusEvent) => textFieldFocusIn(e, state),
    ...(onFocus || onFocusChange || onBlur ? { onFocus: (e: FocusEvent) => focusFocus({ onFocus, onFocusChange }, e) } : {}),
    ...(onBlur || onFocusChange ? { onBlur: (e: FocusEvent) => focusBlur({ onBlur, onFocusChange }, e) } : {}),
    onKeyDown: props.onKeyDown,
    onKeyUp: props.onKeyUp,
  };
  return {
    labelProps: { ...ids.labelProps },
    inputProps,
    descriptionProps: { id: ids.descriptionId },
    errorMessageProps: { id: ids.errorMessageId },
    ids,
    state,
    isInvalid,
    validationErrors: () => displayValidation(state.validation).validationErrors,
    validationDetails: () => displayValidation(state.validation).validationDetails,
  };
}

/** `aria-haspopup` as its string attribute; a live one (accessor) as a returned arrow (resumable). */
function haspopupAttr(value: MaybeAccessor<AriaTextFieldProps["aria-haspopup"]>): MaybeAccessor<string | undefined> {
  if (typeof value === "function") return () => popupString(value());
  return popupString(value);
}
function popupString(value: AriaTextFieldProps["aria-haspopup"]): string | undefined {
  return value === undefined ? undefined : String(value);
}

/** `excludeFromTabOrder` as `tabIndex`; a live one (accessor) as a returned arrow (resumable). */
function tabIndexAttr(value: MaybeAccessor<boolean | undefined>): MaybeAccessor<-1 | undefined> {
  if (typeof value === "function") return () => (value() ? -1 : undefined);
  return value ? -1 : undefined;
}

/** A live `isRequired` as a `required` / `aria-required` value (a returned arrow: resumable); `undefined` when the
 *  validation behaviour does not use that attribute. */
function requiredWhen(isRequired: () => boolean | undefined, applies: boolean): (() => true | undefined) | undefined {
  if (!applies) return undefined;
  return () => !!isRequired() || undefined;
}

/** React `onChange` (native `input`): value → state (`onChange(value)`), native custom validity; then the user's `onInput`. */
export function textFieldInput(event: Event, props: { onInput?: (e: any) => void }, state: TextFieldState): void {
  const input = getEventTarget(event) as FieldElement;
  onFormReset(state, input, () => setControlledValue(state.value, state.initial));
  if (untrack(() => controlledValue(state.value)) !== input.value) {
    setControlledValue(state.value, input.value);
    // A plain controlled value (no Signal) only reports the change (upstream: React re-renders the input with `value`).
    syncValidity(state.validation, input);
  }
  props.onInput?.(event);
}

/** Native `change` (commit: blur after edit, Enter): show the validation result (RA useFormValidation `change` listener). */
export function textFieldChange(event: Event, _props: AriaTextFieldProps, state: TextFieldState): void {
  validationChange(state.validation, event.currentTarget as FieldElement);
}

/** `invalid` (submit / checkValidity): commit, focus the first invalid field (keyboard modality), no browser bubble. */
export function textFieldInvalid(event: Event, _props: AriaTextFieldProps, state: TextFieldState): void {
  validationInvalid(state.validation, event);
}

/** focus: sync the custom validity (server / custom errors) before any submit; user focus events (RA useFocusable). */
export function textFieldFocus(event: FocusEvent, props: Pick<AriaTextFieldProps, "onFocus" | "onFocusChange">, state: TextFieldState): void {
  syncValidity(state.validation, event.currentTarget as FieldElement);
  if (props.onFocus || props.onFocusChange) focusFocus(props, event);
}

/** focusin (delegated) of the input itself: validity sync (`textFieldFocus` without callbacks). */
export function textFieldFocusIn(event: FocusEvent, state: TextFieldState): void {
  if (getEventTarget(event) === event.currentTarget) syncValidity(state.validation, event.currentTarget as FieldElement);
}

/** blur: user focus events (RA useFocusable). */
export function textFieldBlur(event: FocusEvent, props: Pick<AriaTextFieldProps, "onBlur" | "onFocusChange">, _state?: TextFieldState): void {
  if (props.onBlur || props.onFocusChange) focusBlur(props, event);
}

// ---- useFormattedTextField ----

/** RA `FormattedTextFieldState`: the formatter state (NumberField, ColorField). */
export interface FormattedTextFieldState {
  validate: (value: string) => boolean;
  setInputValue: (value: string) => void;
}

/** Composition start snapshot (browser-only, per input). */
const compositionStart = new WeakMap<Element, { value: string; selectionStart: number | null; selectionEnd: number | null }>();

/** RA `onBeforeInputFallback`: cancel input whose resulting value the formatter rejects. */
export function formattedTextFieldBeforeInput(event: InputEvent, formatted: FormattedTextFieldState): void {
  const input = event.currentTarget as HTMLInputElement | null;
  if (!input) return;
  let nextValue: string | null = null;
  const start = input.selectionStart!;
  const end = input.selectionEnd!;
  switch (event.inputType) {
    case "historyUndo":
    case "historyRedo":
    case "insertLineBreak":
      return;
    case "deleteContent":
    case "deleteByCut":
    case "deleteByDrag":
      nextValue = input.value.slice(0, start) + input.value.slice(end);
      break;
    case "deleteContentForward":
      nextValue = end === start ? input.value.slice(0, start) + input.value.slice(end + 1) : input.value.slice(0, start) + input.value.slice(end);
      break;
    case "deleteContentBackward":
      nextValue = end === start ? input.value.slice(0, start - 1) + input.value.slice(start) : input.value.slice(0, start) + input.value.slice(end);
      break;
    case "deleteSoftLineBackward":
    case "deleteHardLineBackward":
      nextValue = input.value.slice(start);
      break;
    default:
      if (event.data != null) nextValue = input.value.slice(0, start) + event.data + input.value.slice(end);
      break;
  }
  if (nextValue == null || !formatted.validate(nextValue)) event.preventDefault();
}

export function formattedTextFieldCompositionStart(event: CompositionEvent): void {
  const input = event.currentTarget as HTMLInputElement;
  compositionStart.set(input, { value: input.value, selectionStart: input.selectionStart, selectionEnd: input.selectionEnd });
}

export function formattedTextFieldCompositionEnd(event: CompositionEvent, formatted: FormattedTextFieldState): void {
  const input = event.currentTarget as HTMLInputElement;
  const saved = compositionStart.get(input);
  if (saved && !formatted.validate(input.value)) {
    // Restore the DOM value at once (selection), and the state too.
    input.value = saved.value;
    input.setSelectionRange(saved.selectionStart, saved.selectionEnd);
    formatted.setInputValue(saved.value);
  }
}

/**
 * RA `useFormattedTextField(props, state, ref)`: `textFieldProps` + input filtering by the formatter
 * (`state.validate(next)` false cancels the `beforeinput`; a rejected composition is undone).
 */
export function formattedTextFieldProps(
  props: AriaTextFieldProps,
  formatted: FormattedTextFieldState,
  inputRef?: InputRef,
  textState?: TextFieldState,
): TextFieldAria {
  const aria = textFieldProps(props, inputRef, textState);
  const { onBeforeInput, onCompositionStart, onCompositionEnd } = props;
  aria.inputProps = {
    ...aria.inputProps,
    onBeforeInput: (e: InputEvent) => {
      formattedTextFieldBeforeInput(e, formatted);
      onBeforeInput?.(e);
    },
    onCompositionStart: (e: CompositionEvent) => {
      formattedTextFieldCompositionStart(e);
      onCompositionStart?.(e);
    },
    onCompositionEnd: (e: CompositionEvent) => {
      formattedTextFieldCompositionEnd(e, formatted);
      onCompositionEnd?.(e);
    },
  };
  return aria;
}

/** Rivet: `setInteractionModality` re-export for fields focusing themselves on invalid. */
export { setInteractionModality };
