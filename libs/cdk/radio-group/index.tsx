// Ported from react-aria-components `RadioGroup` / `Radio` + react-aria `useRadioGroup`, `useRadio` and
// react-stately `useRadioGroupState` (packages/react-aria-components/src/RadioGroup.tsx,
// packages/react-aria/src/radio/*), Apache-2.0, © Adobe.
// <div role=radiogroup> + a <span> label + native radios sharing a name: arrow keys (wrap, skip
// disabled, select on arrow), the single tab stop and form submission are native (zero JS).
// Two forms: RAC compound children (`./parts.tsx`: RadioGroup / RadioField / RadioButton / Radio, contexts) and the Rivet data-driven
// preset (`items` + a render slot, this file).
// Native radios stay visible by default (`inputClass` with a visually hidden class of your own, e.g. Tailwind `sr-only`, hides them).
import { For, Provider } from "@rivetjs/runtime/dom";
import { untrack, type Signal } from "@rivetjs/reactivity";
import type { Content, JSX, Slot } from "@rivetjs/runtime/jsx-runtime";
import { createId } from "@rivetjs/cdk/id";
import { displayValidation, type MaybeAccessor, type ValidationBehavior, type ValidationFunction, type ValidationResult } from "../state/form-validation.ts";
import { createRadioGroupState, type RadioGroupState } from "../state/radio-group.ts";
import { useValidationBehavior, useValidationErrors } from "../form/index.tsx";
import { validityError } from "../form/behaviour.ts";
import { fieldAria } from "../label/behaviour.ts";
import { FieldError, FieldErrorContext } from "../form/field-error.tsx";
import { errorText, fieldDescribedBy } from "../text-field/fields.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { radioChange, radioFocus, radioGroupFocusOut, radioInvalid } from "./behaviour.ts";
import { SharedElementTransition } from "../shared-element-transition/transition.tsx";
import { SelectionIndicatorContext } from "../selection-indicator/context.ts";

import { RadioGroupParts, type RadioGroupPartsProps } from "./parts.tsx";
import { liveOptions } from "../utils/live.tsx";

export type { RadioGroupState } from "../state/radio-group.ts";
export {
  Radio,
  RadioButton,
  RadioContext,
  RadioField,
  RadioFieldContext,
  RadioGroupContext,
  RadioGroupStateContext,
  radioProps,
  type AriaRadioProps,
  type RadioAria,
  type RadioButtonProps,
  type RadioButtonRenderProps,
  type RadioFieldProps,
  type RadioFieldRenderProps,
  type RadioGroupData,
  type RadioGroupPartsProps,
  type RadioGroupRenderProps,
  type RadioProps,
  type RadioRenderProps,
} from "./parts.tsx";

/** One radio (RAC `<Radio>` props): global DOM events / attributes go on its `<label>`, focus / key events (RA FocusableProps) on its input. */
export interface RadioItem extends GlobalDOMAttributes<HTMLLabelElement> {
  readonly value: string;
  readonly label?: string;
  readonly isDisabled?: boolean;
  /** Help text of this radio (linked with aria-describedby). */
  readonly description?: string;
  /** Radio input id (default generated). */
  readonly id?: string;
  readonly onFocus?: (event: FocusEvent) => void;
  readonly onBlur?: (event: FocusEvent) => void;
  readonly onFocusChange?: (isFocused: boolean) => void;
  readonly onKeyDown?: (event: KeyboardEvent) => void;
  readonly onKeyUp?: (event: KeyboardEvent) => void;
  /** @deprecated use `isDisabled` */ readonly disabled?: boolean;
}

/** Props of the data-driven preset (`items`). */
export interface RadioGroupItemsProps extends GlobalDOMAttributes<HTMLDivElement> {
  /** Visible group label (a `<span>`, referenced by aria-labelledby). */
  label?: Content;
  items: readonly RadioItem[];
  /** Selected value (controlled): a two-way Signal, or a plain value (`value={v()}` stays live); or `defaultValue`. */
  value?: Signal<string | null> | string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  /** Form field name (default: a generated id). */
  name?: string;
  form?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isInvalid?: MaybeAccessor<boolean | undefined>;
  validate?: ValidationFunction<string | null>;
  /** @default "native" (or the enclosing `<Form>`'s) */
  validationBehavior?: ValidationBehavior;
  description?: Content;
  errorMessage?: Content | ((validation: ValidationResult) => Content);
  /** @default "vertical" */
  orientation?: "vertical" | "horizontal";
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** Focus entered the group (RA FocusEvents on the group: focus-within). */
  onFocus?: (event: FocusEvent) => void;
  /** Focus left the group. */
  onBlur?: (event: FocusEvent) => void;
  onFocusChange?: (isFocusWithin: boolean) => void;
  /** @default "rv-RadioGroup" */
  class?: string;
  /** Radio (label) class, default `rv-Radio`. */
  itemClass?: string;
  inputClass?: string;
  labelClass?: string;
  descriptionClass?: string;
  errorClass?: string;
  /** Radio content (default: the item label). */
  children?: Slot<[item: () => RadioItem]>;
  /** @deprecated use `isRequired` */ required?: boolean;
  /** @deprecated use `isDisabled` */ disabled?: boolean;
  /** @deprecated use `aria-describedby` */ describedBy?: string;
}

/**
 * A radio group allows a user to select a single item from a list of mutually exclusive options. With `items`: the data-driven preset
 * (below); without: the RAC compound form (`<RadioField>` / `<RadioButton>` / `<Radio>` children, `./parts.tsx`).
 */
export function RadioGroup(props: RadioGroupPartsProps & { items?: undefined }): JSX.Element;
export function RadioGroup(props: RadioGroupItemsProps): JSX.Element;
export function RadioGroup(props: RadioGroupProps): JSX.Element {
  // Live props (P5): the dispatch reads `items` once; the parts render by a direct call (a component spread of a live
  // props object re-created the region on a resumed page: checkbox/CLAUDE.md). The items preset reads its props once.
  return untrack(() => (props.items === undefined ? RadioGroupParts(props as RadioGroupPartsProps) : <RadioGroupItems {...(props as RadioGroupItemsProps)} />));
}

/** `RadioGroup` props: the RAC compound props (`./parts.tsx`, no `items`) or the data-driven preset's (`RadioGroupItemsProps`). */
export type RadioGroupProps = (RadioGroupPartsProps & { items?: undefined }) | RadioGroupItemsProps;

function RadioGroupItems(props: RadioGroupItemsProps) {
  const behaviour = useValidationBehavior(props.validationBehavior);
  const isDisabled = props.isDisabled ?? props.disabled ?? false;
  const isReadOnly = props.isReadOnly ?? false;
  const isRequired = props.isRequired ?? props.required ?? false;
  const state: RadioGroupState = createRadioGroupState({
    // Live props: a controlled `value={v()}` stays live (an accessor into the state).
    value: liveOptions(props, [], ["value"]).value,
    defaultValue: props.defaultValue,
    onChange: props.onChange,
    name: props.name,
    isDisabled,
    isReadOnly,
    isRequired,
    isInvalid: props.isInvalid,
    validate: props.validate,
    validationBehavior: behaviour,
    validationErrors: useValidationErrors(),
  });
  const { items, children: render, errorMessage } = props;
  const id = props.id ?? createId();
  const ids = fieldAria({
    id,
    label: props.label,
    labelElementType: "span",
    description: props.description,
    "aria-label": props["aria-label"],
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": [props["aria-describedby"], props.describedBy].filter(Boolean).join(" ") || undefined,
  });
  const orientation = props.orientation ?? "vertical";
  const itemClass = props.itemClass ?? "rv-Radio";
  const invalid = () => displayValidation(state.validation).isInvalid;
  const showsError = () => errorText(state, errorMessage) !== undefined;
  const groupDescription = ids.descriptionId;
  const { onFocus, onBlur, onFocusChange } = props;
  const dom = globalDOMProps(props);
  const className = props.class;
  const ariaDetails = props["aria-details"];
  return (
    <div
      {...dom}
      id={id}
      role="radiogroup"
      class={className ?? "rv-RadioGroup"}
      aria-orientation={orientation}
      aria-invalid={invalid() ? "true" : undefined}
      aria-disabled={isDisabled ? "true" : undefined}
      aria-readonly={isReadOnly ? "true" : undefined}
      aria-required={isRequired ? "true" : undefined}
      aria-label={ids.fieldProps["aria-label"]}
      aria-labelledby={ids.fieldProps["aria-labelledby"]}
      aria-describedby={fieldDescribedBy(state, ids, errorMessage)}
      aria-details={ariaDetails}
      data-orientation={orientation}
      data-disabled={isDisabled || undefined}
      data-readonly={isReadOnly || undefined}
      data-required={isRequired || undefined}
      data-invalid={invalid() ? "true" : undefined}
      onFocusIn={
        onFocus || onFocusChange
          ? (event) => {
              const group = event.currentTarget as HTMLElement;
              if (group.contains(event.relatedTarget as Node | null)) return;
              onFocus?.(event);
              onFocusChange?.(true);
            }
          : undefined
      }
      onFocusOut={(event) => {
        radioGroupFocusOut(state, event);
        if (!(onBlur || onFocusChange) || (event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) return;
        onBlur?.(event);
        onFocusChange?.(false);
      }}
    >
      {props.label != null ? (
        <span id={ids.labelProps.id} class={props.labelClass ?? "rv-Label"} data-slot="label">
          {props.label}
        </span>
      ) : null}
      {/* RAC RadioGroup: the radios share one SharedElementTransition scope (an animated SelectionIndicator moves between them). */}
      <SharedElementTransition>
        <For each={() => items} by={(item) => item.value}>
          {(item) => {
            const option = item();
            const disabled = isDisabled || !!(option.isDisabled ?? option.disabled);
            const inputId = option.id ?? createId();
            const descriptionId = option.description ? inputId + "-description" : undefined;
            const itemDom = globalDOMProps(option, ["onMouseDown"]);
            const valueProp = option.value;
            return (
              <label
                {...itemDom}
                onMouseDown={(event) => {
                  // RAC Radio mergeProps(DOMProps, labelProps): the user's handler first, then RA useRadio's
                  // "Prevent label from being focused when mouse down on it" (the click still focuses the input).
                  option.onMouseDown?.(event as MouseEvent & { currentTarget: HTMLLabelElement });
                  event.preventDefault();
                }}
                class={itemClass}
                data-selected={state.selectedValue() === valueProp ? "true" : undefined}
                data-disabled={disabled || undefined}
                data-readonly={isReadOnly || undefined}
                data-invalid={invalid() ? "true" : undefined}
                data-required={isRequired || undefined}
              >
                <input
                  type="radio"
                  id={inputId}
                  class={props.inputClass}
                  name={state.name}
                  form={props.form}
                  value={option.value}
                  disabled={disabled || undefined}
                  required={(isRequired && behaviour === "native") || undefined}
                  aria-describedby={
                    [descriptionId, invalid() && showsError() ? ids.errorMessageId : undefined, groupDescription].filter(Boolean).join(" ") || undefined
                  }
                  data-rv-error={validityError(state.validation)}
                  checked={state.selectedValue() === option.value}
                  onChange={(event) => radioChange(state, option.value, event)}
                  onFocus={(event) => {
                    radioFocus(state, option.value, event);
                    option.onFocus?.(event);
                    option.onFocusChange?.(true);
                  }}
                  onBlur={
                    option.onBlur || option.onFocusChange
                      ? (event) => {
                          option.onBlur?.(event);
                          option.onFocusChange?.(false);
                        }
                      : undefined
                  }
                  onKeyDown={option.onKeyDown ? (event) => option.onKeyDown!(event) : undefined}
                  onKeyUp={option.onKeyUp ? (event) => option.onKeyUp!(event) : undefined}
                  onInvalid={(event) => radioInvalid(state, event)}
                />
                {render ? (
                  // RAC Radio: `SelectionIndicatorContext` around the radio content (`isSelected` an accessor).
                  <Provider token={SelectionIndicatorContext} value={{ isSelected: () => state.selectedValue() === valueProp }}>
                    {render(item)}
                  </Provider>
                ) : (
                  option.label
                )}
                {descriptionId ? (
                  <span id={descriptionId} class={props.descriptionClass ?? "rv-Text"} data-slot="description">
                    {option.description}
                  </span>
                ) : null}
              </label>
            );
          }}
        </For>
      </SharedElementTransition>
      {props.description != null ? (
        <span id={ids.descriptionId} class={props.descriptionClass ?? "rv-Text"} data-slot="description">
          {props.description}
        </span>
      ) : null}
      <Provider token={FieldErrorContext} value={() => displayValidation(state.validation)}>
        <FieldError id={ids.errorMessageId} class={props.errorClass ?? "rv-FieldError"}>
          {typeof errorMessage === "function"
            ? () => (errorMessage as (v: ValidationResult) => Content)(displayValidation(state.validation))
            : errorMessage === undefined
              ? undefined
              : () => errorMessage}
        </FieldError>
      </Provider>
    </div>
  );
}
