// Ported from react-aria useSearchField (packages/react-aria/src/searchfield/useSearchField.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useSearchField(props, state, inputRef)` → `searchFieldProps(props, state, inputRef?)` (call during render,
//   from `.tsx`: the bags hold inline-arrow handlers / accessors that resumed bindings and contexts capture).
//   Built on `textFieldProps` (RA useTextField port); the text field state shares the search field's
//   controlled value (RA passes `value: state.value, onChange: state.setValue`).
// - hook-internal handlers → free functions: `searchFieldKeyDown(event, props, state, inputRef)` (the
//   `useKeyboard` Enter / Escape shortcuts), `searchFieldClear(props, state)` (clear button `onPress`),
//   `searchFieldClearPressStart(inputRef)` (clear button `onPressStart`).
// - `inputRef` = a `ref()` (`@rivetjs/runtime/dom`) read at event time.
// - Deviation: upstream's `useKeyboard` also adds an `onKeyUp` that only continues propagation (a no-op on
//   native events); not added.
import { untrack } from "@rivetjs/reactivity";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { formatMessage } from "../_adapters/intl.ts";
import { keyboardKeyDown } from "../interactions/keyboard.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { createFormValidationState, type ValidationResult } from "../state/form-validation.ts";
import { searchFieldValue, setSearchFieldValue, type SearchFieldState } from "../state/search-field.ts";
import { textFieldProps, type AriaTextFieldProps, type PropBag, type TextFieldState } from "../text-field/behaviour.tsx";
import type { FieldIds } from "../label/behaviour.ts";
import { strings as intlMessages } from "./intl.ts";

export interface AriaSearchFieldProps extends Omit<AriaTextFieldProps, "type" | "value"> {
  /** The current value (controlled): a plain value, a two-way Signal, or an accessor read live. */
  value?: AriaTextFieldProps["value"] | (() => string);
  /** Handler that is called when the SearchField is submitted. */
  onSubmit?: (value: string) => void;
  /** Handler that is called when the clear button is pressed. */
  onClear?: () => void;
  /**
   * An enumerated attribute that defines what action label or icon to preset for the enter key on virtual keyboards. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/enterkeyhint).
   */
  enterKeyHint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  /**
   * The type of input to render. See [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#htmlattrdeftype).
   *
   * @default 'search'
   */
  type?: "text" | "search" | "url" | "tel" | "email" | "password" | (string & {});
  /** Locale of the clear button label (default "en-US"). */
  locale?: string;
}

/** Clear button props (RA `AriaButtonProps`, for `ButtonContext`). */
export interface SearchFieldClearButtonProps {
  "aria-label": string;
  excludeFromTabOrder: boolean;
  preventFocusOnPress: boolean;
  /** Rivet (live props): an accessor while the field's `isDisabled` / `isReadOnly` is live. */
  isDisabled: boolean | (() => boolean);
  onPress: () => void;
  onPressStart: () => void;
}

export interface SearchFieldAria {
  /** Props for the text field's visible label element (if any). */
  labelProps: PropBag;
  /** Props for the input element. */
  inputProps: PropBag;
  /** Props for the clear button. */
  clearButtonProps: SearchFieldClearButtonProps;
  /** Props for the searchfield's description element, if any. */
  descriptionProps: PropBag;
  /** Props for the searchfield's error message element, if any. */
  errorMessageProps: PropBag;
  /** Rivet: ids of the field parts. */
  ids: FieldIds;
  /** Rivet: the text field state (shared value + validation). */
  textState: TextFieldState;
  isInvalid: () => boolean;
  validationErrors: () => string[];
  validationDetails: () => ValidationResult["validationDetails"];
}

/** Enter / Escape shortcuts of the search input (upstream `useKeyboard({shortcuts})`). */
export function searchFieldKeyDown(
  e: KeyboardEvent,
  props: Pick<AriaSearchFieldProps, "onSubmit" | "onClear">,
  state: SearchFieldState,
  inputRef: Ref<HTMLInputElement> | undefined,
): void {
  const { onSubmit, onClear } = props;
  keyboardKeyDown(
    {
      shortcuts: {
        Enter: () => {
          if (onSubmit) {
            // for backward compatibility;
            // otherwise, "Enter" on an input would trigger a form submit, the default browser behavior
            onSubmit(searchFieldValue(state));
            return;
          }
          return false;
        },
        Escape: () => {
          // Also check the inputRef value for the case where the value was set directly on the input element instead of going through
          // the hook
          const input = inputRef?.();
          if (searchFieldValue(state) === "" && (!input || input.value === "")) {
            return false;
          }
          setSearchFieldValue(state, "");
          onClear?.();
        },
      },
    },
    e,
  );
}

/** Clear button `onPress` (upstream `onClearButtonClick`). */
export function searchFieldClear(props: Pick<AriaSearchFieldProps, "onClear">, state: SearchFieldState): void {
  setSearchFieldValue(state, "");

  if (props.onClear) {
    props.onClear();
  }
}

/** Clear button `onPressStart`. */
export function searchFieldClearPressStart(inputRef: Ref<HTMLInputElement> | undefined): void {
  // this is in PressStart for mobile so that touching the clear button doesn't remove focus from
  // the input and close the keyboard
  inputRef?.()?.focus();
}

const readFlag = (v: unknown): boolean => !!(typeof v === "function" ? (v as () => unknown)() : v);

/** The clear button's live disabled state (a returned arrow: resumable). */
function clearDisabled(isDisabled: unknown, isReadOnly: unknown): () => boolean {
  return () => readFlag(isDisabled) || readFlag(isReadOnly);
}

/** Provides the behavior and accessibility implementation for a search field. */
export function searchFieldProps(props: AriaSearchFieldProps, state: SearchFieldState, inputRef?: Ref<HTMLInputElement>): SearchFieldAria {
  const { isDisabled, isReadOnly, onSubmit, onClear, type = "search" } = props;
  const read = () => searchFieldValue(state);
  const textState: TextFieldState = {
    value: state.value,
    initial: props.defaultValue ?? untrack(read),
    validation: createFormValidationState({
      isInvalid: props.isInvalid,
      validate: props.validate,
      validationBehavior: props.validationBehavior ?? "aria",
      name: props.name,
      validationErrors: props.validationErrors,
      value: read,
    }),
  };
  // Rivet (live props): a live `isDisabled` / `isReadOnly` (accessor) keeps the shortcuts attached and checks at key time.
  const live = typeof isDisabled === "function" || typeof isReadOnly === "function";
  const keyboardProps: PropBag = live
    ? { onKeyDown: (e: KeyboardEvent) => !(readFlag(isDisabled) || readFlag(isReadOnly)) && searchFieldKeyDown(e, { onSubmit, onClear }, state, inputRef) }
    : isDisabled || isReadOnly
      ? {}
      : { onKeyDown: (e: KeyboardEvent) => searchFieldKeyDown(e, { onSubmit, onClear }, state, inputRef) };

  const text = textFieldProps({ ...props, value: undefined, type } as AriaTextFieldProps, undefined, textState);

  return {
    labelProps: text.labelProps,
    // An edge case, in Autocomplete, if the keyboard hanlders are not in this order, then
    // Escape runs autocomplete/listbox first, then the search-field shortcut returns false and
    // continues propagation, leaking Escape to a parent Dialog.
    inputProps: mergeProps(keyboardProps, {
      ...text.inputProps,
      // already handled by useSearchFieldState
      defaultValue: undefined,
    }) as PropBag,
    clearButtonProps: {
      "aria-label": formatMessage(intlMessages, props.locale, "Clear search"),
      excludeFromTabOrder: true,
      preventFocusOnPress: true,
      isDisabled: live ? clearDisabled(isDisabled, isReadOnly) : !!(isDisabled || isReadOnly),
      onPress: () => searchFieldClear({ onClear }, state),
      onPressStart: () => searchFieldClearPressStart(inputRef),
    },
    descriptionProps: text.descriptionProps,
    errorMessageProps: text.errorMessageProps,
    ids: text.ids,
    textState,
    isInvalid: text.isInvalid,
    validationErrors: text.validationErrors,
    validationDetails: text.validationDetails,
  };
}
