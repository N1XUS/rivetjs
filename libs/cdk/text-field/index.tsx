// Ported from react-aria-components `TextField` (packages/react-aria-components/src/TextField.tsx), Apache-2.0, © Adobe.
// A text field allows a user to enter a plain text value with a keyboard.
// Rivet:
// - composed from parts like RAC: `<TextField><Label/><Input/> | <TextArea/><Text slot="description"/><FieldError/></TextField>`;
//   the field provides `LabelContext`, `InputContext`, `TextAreaContext`, `TextContext` (description /
//   errorMessage slots) and `FieldErrorContext`.
// - the input bags hold accessors (`value`, `aria-invalid`, `aria-describedby`, `aria-labelledby`): the
//   parts spread them and the runtime spread reads them in bindings.
// - RAC picks input-only attributes (`type`, `pattern`) from the element the ref receives; Rivet gives
//   `InputContext` the input bag and `TextAreaContext` the same bag without them.
// - description / error ids are slot ids (RA `useSlotId`): part of `aria-describedby` while that part renders (server: a slot
//   probe, `probeSlots`, marks them before the input renders, as Select; a resumed page never re-renders).
// - render props are accessors (`class={({ isInvalid }) => (isInvalid() ? "bad" : "")}`).
// - `isInvalid` accepts an accessor (`() => !ok()`), live without re-rendering.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, TextFieldRenderProps)` instead of the default `<div>`. Deviations: not a hideable collection component; no `GroupContext` (Group has no
// context yet); `FieldInputContext` (Autocomplete) not merged yet.
import { createContext, untrack } from "@rivetjs/reactivity";
import { definedProps } from "../interactions/merge-props.tsx";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { liveRenderProps } from "../slots/index.tsx";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { LabelContext } from "../label/index.tsx";
import { InputContext } from "../input/index.tsx";
import { TextAreaContext } from "../text-area/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots, slotProbing } from "#server";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { idSignal } from "../utils/id.ts";
import { FieldInputContext } from "../autocomplete/contexts.ts";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  slotIdRef,
  slottedContext,
  renderProps,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { createTextFieldState, textFieldProps, type AriaTextFieldProps, type InputRef } from "./behaviour.tsx";

export type { ValidationResult } from "../state/form-validation.ts";

export interface TextFieldRenderProps {
  /**
   * Whether the text field is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the value is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the text field is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the text field is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
}

export interface TextFieldProps
  extends
    Omit<AriaTextFieldProps, "label" | "placeholder" | "description" | "errorMessage" | "validationBehavior" | "validationErrors" | "inputElementType">,
    RACValidation,
    SlotProps,
    RenderProps<TextFieldRenderProps>,
    DOMRenderProps<"div", TextFieldRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onInput" | "onBeforeInput"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-TextField'
   */
  class?: RenderProps<TextFieldRenderProps>["class"];
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `TextFieldContext`. */
export const TextFieldContext = createContext<ContextValue<TextFieldProps, HTMLDivElement>>(null);

const OWNED = ["style", "render"] as const;
const INPUT_ONLY = ["type", "pattern"] as const;
/** Live props (P5): keys made accessors at the boundary (read with `read` / resolved by the input spread). */
const LIVE_KEYS = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "type",
  "placeholder",
  "maxLength",
  "minLength",
  "pattern",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-controls",
  "aria-activedescendant",
  "aria-autocomplete",
  "aria-haspopup",
  "autoComplete",
  "autoCapitalize",
  "autoCorrect",
  "spellCheck",
  "inputMode",
  "enterKeyHint",
  "form",
  "excludeFromTabOrder",
] as const;

/**
 * A text field allows a user to enter a plain text value with a keyboard.
 */
export function TextField(props: TextFieldProps) {
  const [own, ref] = contextProps(props, props.ref, TextFieldContext);
  // RAC: an enclosing Autocomplete / ComboBox passes its input props (value accessor, handlers, aria-*).
  const [ctxMerged, fieldInputRef] = contextProps(own, undefined, FieldInputContext as never) as unknown as [TextFieldProps, InputRef | undefined];
  // Live props (P5): live state / attribute keys become accessors at the boundary (the input bag's spread and the
  // validation read them); `value` is controlled (an accessor only when defined at creation). Body reads untracked.
  // Live by default (LIVE-SWEEP): every attribute-like prop is a LIVE_KEYS entry; read once: `id`, `name`,
  // `aria-label` / `aria-labelledby`, `autoFocus`, `defaultValue`, `validationBehavior`, `validate`, handlers.
  const live = hasLive(ctxMerged);
  const merged = live ? liveOptions(ctxMerged, LIVE_KEYS as never, ["value"]) : ctxMerged;
  return untrack(() => textField(props, own, merged, live, ref, fieldInputRef));
}

function textField(
  props: TextFieldProps,
  own: TextFieldProps,
  merged: TextFieldProps,
  live: boolean,
  ref: RefValue<HTMLDivElement> | undefined,
  fieldInputRef: InputRef | undefined,
) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const fieldInput = slottedContext(FieldInputContext, own.slot) as { onPointerDown?: (e: PointerEvent) => void } | null;
  const fieldPointerDown = fieldInput?.onPointerDown;
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  const state = createTextFieldState({
    value: merged.value,
    defaultValue: merged.defaultValue,
    onChange: merged.onChange,
    isInvalid: merged.isInvalid,
    validate: merged.validate,
    validationBehavior,
    name: merged.name,
    validationErrors: formValidationErrors(),
  });
  const { labelProps, inputProps, descriptionProps, errorMessageProps, ids, isInvalid, validationErrors, validationDetails } = textFieldProps(
    { ...merged, label: initialLabel, validationBehavior },
    fieldInputRef,
    state,
  );

  // RA useSlotId: the description / error ids are described-by while their part renders.
  const descriptionId = createSlotId((descriptionProps.id as string | undefined) ?? (merged.id ? merged.id + "-description" : undefined));
  // The error part renders while invalid: re-check its id when that changes.
  const errorId = createSlotId(errorMessageProps.id as string, isInvalid);
  // RA mergeIds: an `id` on the Input / TextArea part switches this reactive id, so the label's `for` follows it.
  const inputId = idSignal(inputProps.id as string);
  const hasFor = !!labelProps.for;
  const extraDescribedBy = merged["aria-describedby"] as MaybeAccessor<string | undefined>;
  const labelledBy = ids.fieldProps["aria-labelledby"];
  const ownLabelledBy = merged["aria-labelledby"];
  const input = {
    // The ~45-key RA bag holds mostly `undefined` (unset aria / text input attributes): only its defined keys, so every
    // copy / spread of the context bag downstream (Input `contextProps`, rest, element spread) walks ~15 keys.
    ...definedProps(inputProps),
    "aria-labelledby": () => (initialLabel && hasLabel() ? labelledBy : initialLabel ? ownLabelledBy : labelledBy),
    // RA useSlotId: ids of the parts that render. Server: the slot probe below marks them before the input renders (a
    // resumed page never re-renders, so an id kept on expectation would stay an IDREF to nothing).
    "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorId, isInvalid()), read(extraDescribedBy)].filter(Boolean).join(" ") || undefined,
    onPointerDown: fieldPointerDown,
  };
  const textArea: Record<string, unknown> = { ...input };
  for (const key of INPUT_ONLY) delete textArea[key];

  const disabledProp = merged.isDisabled as MaybeAccessor<boolean | undefined>;
  const readOnlyProp = merged.isReadOnly as MaybeAccessor<boolean | undefined>;
  const isDisabled = () => !!read(disabledProp);
  const isReadOnly = () => !!read(readOnlyProp);
  const requiredProp = merged.isRequired as MaybeAccessor<boolean | undefined>;
  const isRequired = () => !!read(requiredProp);
  const renderValues = { isDisabled, isInvalid, isReadOnly, isRequired };
  const rp = live
    ? renderProps({ values: renderValues, defaultClassName: "rv-TextField" }, liveRenderProps(merged) as never)
    : renderProps({
        ...merged,
        values: renderValues,
        defaultClassName: "rv-TextField",
      });
  // Object-literal function value (R2 makes it a resumable symbol; a plain local const arrow is not, and a
  // provider entry holding one is dropped when a resumed region is re-created).
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };

  // The root gets the field's own DOM props, not the FieldInputContext ones (those are the input's).
  const dom = globalDOMProps(own, OWNED);
  const slot = merged.slot || undefined;
  const values: ProviderValue<any>[] = [
    [LabelContext, { ...labelProps, for: () => (hasFor ? inputId() : undefined), ref: labelRef }],
    [InputContext, input],
    [TextAreaContext, textArea],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [FieldErrorContext, fieldError.validation],
  ];
  // Rivet (server): the input renders before its Description / FieldError: probe which slotted parts render (as Select).
  if (typeof document === "undefined") probeSlots(values, () => rp.children());
  if (merged.render)
    return merged.render(
      {
        ...dom,
        ref: ref as never,
        class: () => rp.class(),
        style: () => rp.style(),
        slot,
        "data-disabled": () => isDisabled() || undefined,
        "data-invalid": () => isInvalid() || undefined,
        "data-readonly": () => isReadOnly() || undefined,
        "data-required": () => isRequired() || undefined,
        children: () => <Provider values={values}>{rp.children()}</Provider>,
      } as never,
      renderValues,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      data-disabled={isDisabled() || undefined}
      data-invalid={isInvalid() || undefined}
      data-readonly={isReadOnly() || undefined}
      data-required={isRequired() || undefined}
    >
      <Provider values={values}>{rp.children()}</Provider>
    </div>
  );
}

// Angular CDK text-field (autosize, autofill), formerly @rivetjs/cdk/text-field.
export * from "./autosize.ts";
