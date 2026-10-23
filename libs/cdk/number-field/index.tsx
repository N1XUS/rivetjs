// Ported from react-aria-components `NumberField` (packages/react-aria-components/src/NumberField.tsx), Apache-2.0, © Adobe.
// A number field allows a user to enter a number, and increment or decrement the value using stepper buttons.
// Rivet:
// - composed from parts like RAC: `<NumberField><Label/><Group><Button slot="decrement"/><Input/><Button slot="increment"/></Group>
//   <Text slot="description"/><FieldError/></NumberField>`; the field provides `NumberFieldStateContext`, `GroupContext`,
//   `InputContext`, `LabelContext`, `ButtonContext` (slots `increment` / `decrement`), `TextContext` (slots
//   `description` / `errorMessage`) and `FieldErrorContext`.
// - state = `createNumberFieldState` (`../number/number-field-state.tsx`: plain signals + free functions); behaviour =
//   `./behaviour.tsx` (`numberFieldProps` bags with accessor values; the handlers are bound here from inline arrows, so
//   typing / stepping / wheel resume with no code before the first interaction).
// - locale from `useLocale()` (`I18nProvider`); `validationBehavior` defaults to the `Form` context, then `native`.
// - description / error ids are slot ids (RA useField `useSlotId`): part of `aria-describedby` while the part renders.
// - render props are accessors (`isInvalid()`, `isDisabled()`, …); `state` is the state object.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, NumberFieldRenderProps)` instead of the default `<div>` (the hidden form input stays a sibling). Deviations: the unmount cleanup of RA (spin timers / wheel listener) runs from the handlers
// (press end, focus out), not on unmount.
/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
import { probeSlots, slotProbing } from "#server";
import { createContext, untrack } from "@rivetjs/reactivity";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { useLocale } from "../i18n/index.ts";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { ButtonContext } from "../button/index.tsx";
import { GroupContext } from "../group/index.tsx";
import { InputContext } from "../input/index.tsx";
import { LabelContext } from "../label/index.tsx";
import { TextContext } from "../text/index.tsx";
import { dataBool } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  removeDataAttributes,
  renderPropsOf,
  slotIdRef,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { createNumberFieldState, numberValue, type NumberFieldState } from "../number/number-field-state.tsx";
import {
  numberFieldBeforeInput,
  numberFieldBlur,
  numberFieldButtonBlur,
  numberFieldButtonFocus,
  numberFieldChange,
  numberFieldCompositionEnd,
  numberFieldCompositionStart,
  numberFieldDecrementPressEnd,
  numberFieldDecrementPressStart,
  numberFieldDecrementPressUp,
  numberFieldFocus,
  numberFieldGroupFocusIn,
  numberFieldGroupFocusOut,
  numberFieldIncrementPressEnd,
  numberFieldIncrementPressStart,
  numberFieldIncrementPressUp,
  numberFieldInput,
  numberFieldInvalid,
  numberFieldKeyDown,
  numberFieldKeyUp,
  numberFieldPaste,
  numberFieldProps,
  type AriaNumberFieldProps,
} from "./behaviour.tsx";
import type { PressEvent } from "../interactions/press.tsx";

export * from "./behaviour.tsx";
export type { NumberFieldState } from "../number/number-field-state.tsx";

export interface NumberFieldRenderProps {
  /**
   * Whether the number field is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the number field is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the number field is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the number field is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /** State of the number field. */
  state: NumberFieldState;
}

export interface NumberFieldProps
  extends
    Omit<AriaNumberFieldProps, "label" | "placeholder" | "description" | "errorMessage" | "validationState" | "validationBehavior" | "locale">,
    RACValidation,
    RenderProps<NumberFieldRenderProps>,
    SlotProps,
    DOMRenderProps<"div", NumberFieldRenderProps>,
    Omit<
      GlobalDOMAttributes<HTMLDivElement>,
      | "style"
      | "onFocus"
      | "onBlur"
      | "onKeyDown"
      | "onKeyUp"
      | "onCopy"
      | "onCut"
      | "onPaste"
      | "onCompositionStart"
      | "onCompositionEnd"
      | "onCompositionUpdate"
      | "onSelect"
      | "onBeforeInput"
      | "onInput"
    > {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-NumberField'
   */
  class?: RenderProps<NumberFieldRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `NumberFieldContext`. */
export const NumberFieldContext = createContext<ContextValue<Partial<NumberFieldProps>, HTMLDivElement>>(null);
/** RAC `NumberFieldStateContext`. */
export const NumberFieldStateContext = createContext<NumberFieldState | null>(null);

const OWNED = [
  "render",
  "style",
  "id",
  "onFocus",
  "onBlur",
  "onKeyDown",
  "onKeyUp",
  "onCopy",
  "onCut",
  "onPaste",
  "onCompositionStart",
  "onCompositionEnd",
  "onCompositionUpdate",
  "onSelect",
  "onBeforeInput",
  "onInput",
] as const;

/**
 * A number field allows a user to enter a number, and increment or decrement the value using stepper buttons.
 */
export function NumberField(props: NumberFieldProps) {
  // Live props (P5): isDisabled / isReadOnly / isInvalid and a controlled `value` become accessors (state + behaviour
  // read them with `read`), as min / max / step / formatOptions; class / style / children from a live view.
  return untrack(() => numberField(props));
}

/** Live by default (LIVE-SWEEP): the state reads `minValue` / `maxValue` / `step` / `formatOptions` with `read` on
 *  every use. Read once: `id`, `name`, `form`, `aria-label` / `aria-labelledby`, `increment` / `decrementAriaLabel`
 *  (labelling ids), `autoFocus`, `defaultValue`, `validationBehavior`, `validate`, handlers. */
const LIVE_KEYS = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "minValue",
  "maxValue",
  "step",
  "formatOptions",
  "isWheelDisabled",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
] as const;

function numberField(props: NumberFieldProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const [ctxMerged, ref] = contextProps(props, props.ref, NumberFieldContext as never) as [NumberFieldProps, RefValue<HTMLDivElement> | undefined];
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, LIVE_KEYS as never, ["value"] as never) : ctxMerged;
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const { locale } = useLocale();
  const state = createNumberFieldState({ ...merged, locale, validationBehavior, validationErrors: formValidationErrors() });
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // PROPS-CAPTURE: handlers capture `aria`; component-only keys (children / class / style / ref) stay out of it.
  const {
    children: _children,
    class: _class,
    style: _style,
    ref: _ref,
    slot: _slot,
    ...hookProps
  } = removeDataAttributes(merged) as NumberFieldProps & Record<string, unknown>;
  const aria: AriaNumberFieldProps = { ...(hookProps as unknown as AriaNumberFieldProps), label: initialLabel, validationBehavior, locale };
  const field = numberFieldProps(aria, state);
  const {
    labelProps,
    groupProps,
    inputProps,
    incrementButtonProps,
    decrementButtonProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
    validationErrors,
    validationDetails,
  } = field;

  // RA useField `useSlotId`: the description / error ids are described-by while their part renders (server: marked by the
  // slot probe below; a resumed page never re-renders, so an id kept on expectation would be an IDREF to nothing).
  const descriptionId = createSlotId(merged.id ? merged.id + "-description" : (descriptionProps.id as string | undefined));
  const errorId = createSlotId(errorMessageProps.id as string);
  const extraDescribedBy = merged["aria-describedby"] as MaybeAccessor<string | undefined>;
  const labelledBy = inputProps["aria-labelledby"] as string | undefined;
  const ownLabelledBy = merged["aria-labelledby"];
  const input = {
    ...inputProps,
    // Inline arrow in the literal (R2-wrapped; an arrow inside a conditional expression is not).
    "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
    "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorId, isInvalid()), read(extraDescribedBy)].filter(Boolean).join(" ") || undefined,
    onInput: (e: Event) => numberFieldInput(e, aria, state, field),
    onChange: (e: Event) => numberFieldChange(e, aria, state, field),
    onInvalid: (e: Event) => numberFieldInvalid(e, aria, state),
    onFocus: (e: FocusEvent) => numberFieldFocus(e, aria, state, field),
    onBlur: (e: FocusEvent) => numberFieldBlur(e, aria, state, field),
    onKeyDown: (e: KeyboardEvent) => numberFieldKeyDown(e, aria, state, field),
    onKeyUp: (e: KeyboardEvent) => numberFieldKeyUp(e, aria, state, field),
    onPaste: (e: ClipboardEvent) => numberFieldPaste(e, aria, state),
    onBeforeInput: (e: InputEvent) => numberFieldBeforeInput(e, aria, state),
    onCompositionStart: (e: CompositionEvent) => numberFieldCompositionStart(e, aria, state),
    onCompositionEnd: (e: CompositionEvent) => numberFieldCompositionEnd(e, aria, state),
  };
  const group = {
    ...groupProps,
    "aria-disabled": groupProps["aria-disabled"],
    "aria-invalid": groupProps["aria-invalid"],
    onFocusIn: (e: FocusEvent) => numberFieldGroupFocusIn(e, aria, state, field),
    onFocusOut: (e: FocusEvent) => numberFieldGroupFocusOut(e, aria, state, field),
  };
  const increment = {
    ...incrementButtonProps,
    onPressStart: (e: PressEvent) => numberFieldIncrementPressStart(e, aria, state, field),
    onPressUp: (e: PressEvent) => numberFieldIncrementPressUp(e, aria, state, field),
    onPressEnd: (e: PressEvent) => numberFieldIncrementPressEnd(e, aria, state, field),
    onFocus: (e: FocusEvent) => numberFieldButtonFocus(e, aria, state, field),
    onBlur: (e: FocusEvent) => numberFieldButtonBlur(e, aria, state, field),
  };
  const decrement = {
    ...decrementButtonProps,
    onPressStart: (e: PressEvent) => numberFieldDecrementPressStart(e, aria, state, field),
    onPressUp: (e: PressEvent) => numberFieldDecrementPressUp(e, aria, state, field),
    onPressEnd: (e: PressEvent) => numberFieldDecrementPressEnd(e, aria, state, field),
    onFocus: (e: FocusEvent) => numberFieldButtonFocus(e, aria, state, field),
    onBlur: (e: FocusEvent) => numberFieldButtonBlur(e, aria, state, field),
  };

  const isDisabled = merged.isDisabled;
  const isReadOnly = merged.isReadOnly;
  const isRequired = merged.isRequired;
  const disabled = () => !!(typeof isDisabled === "function" ? isDisabled() : isDisabled);
  const readOnly = () => !!(typeof isReadOnly === "function" ? isReadOnly() : isReadOnly);
  const required = () => !!(typeof isRequired === "function" ? isRequired() : isRequired);
  const values: NumberFieldRenderProps = { state, isDisabled: disabled, isInvalid, isRequired: required, isReadOnly: readOnly };
  const rp = renderPropsOf<NumberFieldRenderProps>(merged, { values, defaultClassName: "rv-NumberField" });
  // Object-literal function value (R2 resumable symbol, as TextField's): with a plain const arrow the FieldError of
  // a resumed NumberField never saw the validation.
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };

  const dom = globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const name = merged.name;
  const form = merged.form;
  const providers: ProviderValue<any>[] = [
    [NumberFieldStateContext, state],
    [GroupContext, group],
    [InputContext, input],
    [LabelContext, { ...labelProps, ref: labelRef }],
    [ButtonContext, { slots: { increment, decrement } }],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [FieldErrorContext, fieldError.validation],
  ];
  // Rivet (server): the input renders before its Description / FieldError: probe which slotted parts render (as Select).
  if (typeof document === "undefined") probeSlots(providers, () => rp.children());
  if (merged.render)
    return (
      <Provider values={providers}>
        {merged.render(
          {
            ...dom,
            ref: ref as never,
            class: () => rp.class(),
            style: () => rp.style(),
            slot,
            "data-disabled": () => dataBool(disabled()),
            "data-readonly": () => dataBool(readOnly()),
            "data-required": () => dataBool(required()),
            "data-invalid": () => dataBool(isInvalid()),
            children: () => rp.children(),
          } as never,
          values,
        )}
        {name ? (
          <input type="hidden" name={name} form={form} value={isNaN(numberValue(state)) ? "" : String(numberValue(state))} disabled={disabled() || undefined} />
        ) : null}
      </Provider>
    );
  return (
    <Provider values={providers}>
      <div
        {...dom}
        ref={ref as never}
        class={rp.class()}
        style={rp.style()}
        slot={slot}
        data-disabled={dataBool(disabled())}
        data-readonly={dataBool(readOnly())}
        data-required={dataBool(required())}
        data-invalid={dataBool(isInvalid())}
      >
        {rp.children()}
      </div>
      {name ? (
        <input type="hidden" name={name} form={form} value={isNaN(numberValue(state)) ? "" : String(numberValue(state))} disabled={disabled() || undefined} />
      ) : null}
    </Provider>
  );
}
