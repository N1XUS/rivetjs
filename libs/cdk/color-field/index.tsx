// Ported from react-aria-components `ColorField` (packages/react-aria-components/src/ColorField.tsx), Apache-2.0, © Adobe.
// A color field allows users to edit a hex color or individual color channel value.
// Children: `<Label />`, `<Input />`, `<Text slot="description" />`, `<FieldError />`.
// Rivet:
// - `channel` set → channel field (`createColorChannelFieldState` + `colorChannelFieldProps`, a number field over the
//   channel); else hex field (`createColorFieldState` + `colorFieldProps`). Both provide `InputContext` with the input
//   bag (accessors read in bindings; handlers = inline arrows over the `./behaviour.tsx` free functions: resumable).
// - `value` = plain value, read-only accessor (ColorPicker) or two-way Signal (string | Color | null).
// - description / error ids are slot ids (RA `useSlotId`): part of `aria-describedby` while that part renders.
// - render props are accessors (`isInvalid()`); `state` is the serializable state object.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, ColorFieldRenderProps)` instead of the default `<div>` (the hidden form input stays a sibling).
import { createContext, untrack } from "@rivetjs/reactivity";
import {
  createColorChannelFieldState,
  numberFieldView,
  type Color,
  type ColorChannel,
  type ColorChannelFieldState,
  type ColorFieldState,
  type ColorInput,
  type ColorSpace,
} from "@rivetjs/cdk/color";
import { useLocale } from "@rivetjs/cdk/i18n";
import { channelFieldColorValue } from "../color/channel-field-state.tsx";
// Direct .tsx import: the resume build walks .tsx imports only (not through the .ts barrel), and the state's
// `validate` accessor is a resumable symbol of that module.
import { createColorFieldState } from "../color/field-state.tsx";
import type { MaybeAccessor, ValidationResult } from "../state/form-validation.ts";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { LabelContext } from "../label/index.tsx";
import { InputContext } from "../input/index.tsx";
import { GroupContext } from "../group/index.tsx";
import { TextContext } from "../text/index.tsx";
import { probeSlots, slotProbing } from "#server";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { numberValue } from "../number/number-field-state.tsx";
import {
  numberFieldBeforeInput,
  numberFieldBlur,
  numberFieldChange,
  numberFieldCompositionEnd,
  numberFieldCompositionStart,
  numberFieldFocus,
  numberFieldGroupFocusIn,
  numberFieldGroupFocusOut,
  numberFieldInput,
  numberFieldInvalid,
  numberFieldKeyDown,
  numberFieldKeyUp,
  numberFieldPaste,
} from "../number-field/behaviour.tsx";
import {
  Provider,
  contextProps,
  createSlot,
  createSlotId,
  renderPropsOf,
  slotIdRef,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import {
  colorChannelFieldNumberProps,
  colorChannelFieldProps,
  colorFieldBeforeInput,
  colorFieldBlur,
  colorFieldChange,
  colorFieldCompositionEnd,
  colorFieldCompositionStart,
  colorFieldFocus,
  colorFieldInput,
  colorFieldInvalid,
  colorFieldKeyDown,
  colorFieldKeyUp,
  colorFieldProps,
  type AriaColorFieldProps,
} from "./behaviour.tsx";
import { hasLive, liveAssign, liveOptions } from "../utils/live.tsx";
import { read } from "../interactions/utils.ts";

export * from "./behaviour.tsx";

export interface ColorFieldRenderProps {
  /**
   * Whether the color field is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the color field is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the color field is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the color field is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /**
   * The color channel that this field edits, or "hex" if no `channel` prop is set.
   *
   * @selector [data-channel="hex | hue | saturation | ..."]
   */
  channel: ColorChannel | "hex";
  /** State of the color field. */
  state: ColorFieldState | ColorChannelFieldState;
}

export interface ColorFieldProps
  extends
    Omit<AriaColorFieldProps, "label" | "placeholder" | "description" | "errorMessage" | "validationBehavior" | "locale" | "isInvalid" | "value">,
    RACValidation,
    RenderProps<ColorFieldRenderProps>,
    DOMRenderProps<"div", ColorFieldRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onInput" | "onBeforeInput" | "onCopy" | "onCut" | "onPaste" | "onSelect"> {
  /** The current value (controlled): a two-way signal, a read-only accessor or a fixed value. */
  value?: ColorInput<string | Color | null>;
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  /**
   * The color channel that this field edits. If not provided,
   * the color is edited as a hex value.
   */
  channel?: ColorChannel;
  /**
   * The color space that the color field operates in if a `channel` prop is provided.
   * If no `channel` is provided, the color field always displays the color as an RGB hex value.
   */
  colorSpace?: ColorSpace;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ColorField'
   */
  class?: RenderProps<ColorFieldRenderProps>["class"];
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `ColorFieldContext`. */
export const ColorFieldContext = createContext<ContextValue<Partial<ColorFieldProps>, HTMLDivElement>>(null);
/** RAC `ColorFieldStateContext`. */
export const ColorFieldStateContext = createContext<ColorFieldState | ColorChannelFieldState | null>(null);

const OWNED = ["style", "id", "render"] as const;

interface Parts {
  merged: ColorFieldProps;
  state: ColorFieldState | ColorChannelFieldState;
  ref: unknown;
  labelProps: Record<string, unknown>;
  labelRef: unknown;
  input: Record<string, unknown>;
  descriptionId: ReturnType<typeof createSlotId>;
  errorId: ReturnType<typeof createSlotId>;
  isInvalid: () => boolean;
  validation: () => ValidationResult;
  hidden?: { name: string; form: string | undefined; value: () => string };
}

/**
 * A color field allows users to edit a hex color or individual color channel value.
 */
export function ColorField(props: ColorFieldProps) {
  // Live props (P5): `isDisabled` / `isReadOnly` / `isInvalid` (+ `isRequired` on a hex field) and a controlled `value`
  // become accessors (state / behaviour / attributes read them); the rest of the body is read once (untracked: a prop
  // change never re-creates the field). `channel` / `colorSpace` are read once.
  return untrack(() => colorField(props));
}

/** Live keys (channel field: the number field reads `isRequired` once, as NumberField). */
const CHANNEL_LIVE = ["isDisabled", "isReadOnly", "isInvalid"] as const;
const HEX_LIVE = ["isDisabled", "isReadOnly", "isInvalid", "isRequired"] as const;

function colorField(props: ColorFieldProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, ColorFieldContext);
  const channel = ctxMerged.channel;
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, (channel ? CHANNEL_LIVE : HEX_LIVE) as never, ["value"]) : ctxMerged;
  return channel ? ColorChannelField(merged, ref) : HexColorField(merged, ref);
}

/** `true` while a live flag is set (a returned arrow: resumable symbol). */
function liveFlag(flag: () => unknown): () => true | undefined {
  return () => !!flag() || undefined;
}
/** A flag attribute: `true` / `undefined`, or an accessor of it while the flag is live. */
const flagAttr = (flag: unknown): (() => true | undefined) | true | undefined =>
  typeof flag === "function" ? liveFlag(flag as () => unknown) : (flag as boolean | undefined) || undefined;

function labelSetup(merged: ColorFieldProps) {
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  return { initialLabel, labelRef, hasLabel };
}

function HexColorField(merged: ColorFieldProps, ref: unknown) {
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const { initialLabel, labelRef, hasLabel } = labelSetup(merged);
  const { locale } = useLocale();
  // `merged` (live props: accessors for the live keys, other getters forwarded) is read untracked here.
  const state = createColorFieldState({
    value: merged.value,
    defaultValue: merged.defaultValue,
    onChange: merged.onChange,
    isInvalid: merged.isInvalid as boolean | undefined,
    validate: merged.validate,
    validationBehavior,
    validationErrors: formValidationErrors() as never,
    name: merged.name,
  });
  const ariaProps: AriaColorFieldProps = { ...merged, label: initialLabel, validationBehavior, locale } as AriaColorFieldProps;
  const aria = colorFieldProps(ariaProps, state);
  // Handlers capture only the plain props they need (a resumed handler serializes its captures).
  const hp: AriaColorFieldProps = {
    isDisabled: merged.isDisabled,
    isReadOnly: merged.isReadOnly,
    isRequired: merged.isRequired,
    isWheelDisabled: merged.isWheelDisabled,
    locale,
    onFocus: merged.onFocus,
    onBlur: merged.onBlur,
    onFocusChange: merged.onFocusChange,
    onKeyDown: merged.onKeyDown,
    onKeyUp: merged.onKeyUp,
    onBeforeInput: merged.onBeforeInput,
    onCompositionStart: merged.onCompositionStart,
    onCompositionEnd: merged.onCompositionEnd,
    onInput: merged.onInput,
  };
  const input: Record<string, unknown> = {
    ...aria.inputProps,
    onCopy: merged.onCopy,
    onCut: merged.onCut,
    onPaste: merged.onPaste,
    onSelect: merged.onSelect,
    onCompositionUpdate: merged.onCompositionUpdate,
    onInput: (e: Event) => colorFieldInput(e, hp, state, aria),
    onChange: (e: Event) => colorFieldChange(e, hp, state),
    onInvalid: (e: Event) => colorFieldInvalid(e, hp, state),
    onBeforeInput: (e: InputEvent) => colorFieldBeforeInput(e, hp, state),
    onCompositionStart: (e: CompositionEvent) => colorFieldCompositionStart(e, hp, state),
    onCompositionEnd: (e: CompositionEvent) => colorFieldCompositionEnd(e, hp, state),
    onKeyDown: (e: KeyboardEvent) => colorFieldKeyDown(e, hp, state, aria),
    onKeyUp: (e: KeyboardEvent) => colorFieldKeyUp(e, hp, state, aria),
    onFocus: (e: FocusEvent) => colorFieldFocus(e, hp, state, aria),
    onBlur: (e: FocusEvent) => colorFieldBlur(e, hp, state, aria),
  };
  return renderField({ merged, state, ref, labelRef, ...wire(merged, aria, input, initialLabel, hasLabel) });
}

function ColorChannelField(merged: ColorFieldProps, ref: unknown) {
  const validationBehavior = formValidationBehavior(merged.validationBehavior);
  const { initialLabel, labelRef, hasLabel } = labelSetup(merged);
  const { locale } = useLocale();
  const state = createColorChannelFieldState({
    value: merged.value,
    defaultValue: merged.defaultValue,
    onChange: merged.onChange,
    channel: merged.channel!,
    colorSpace: merged.colorSpace,
    isDisabled: merged.isDisabled,
    isReadOnly: merged.isReadOnly,
    locale,
  });
  // Explicit fields, no `...merged`: number-field closures capture this bag (a resumed handler serializes its captures).
  const base = {
    isDisabled: merged.isDisabled,
    isReadOnly: merged.isReadOnly,
    isRequired: merged.isRequired,
    isInvalid: merged.isInvalid,
    isWheelDisabled: merged.isWheelDisabled,
    validationBehavior,
    locale,
    label: initialLabel,
    "aria-label": merged["aria-label"],
    "aria-labelledby": merged["aria-labelledby"],
    onFocus: merged.onFocus,
    onBlur: merged.onBlur,
    onFocusChange: merged.onFocusChange,
    onKeyDown: merged.onKeyDown,
    onKeyUp: merged.onKeyUp,
    onPaste: merged.onPaste,
    onBeforeInput: merged.onBeforeInput,
    onCompositionStart: merged.onCompositionStart,
    onCompositionEnd: merged.onCompositionEnd,
    onInput: merged.onInput,
  };
  const ext = merged as Record<string, unknown>;
  const channelProps = {
    ...base,
    "aria-describedby": ext["aria-describedby"],
    "aria-details": ext["aria-details"],
    "aria-errormessage": ext["aria-errormessage"],
    placeholder: ext.placeholder,
    autoFocus: ext.autoFocus,
    excludeFromTabOrder: ext.excludeFromTabOrder,
    description: ext.description,
    errorMessage: ext.errorMessage,
  } as never;
  const aria = colorChannelFieldProps(channelProps, state);
  const np = colorChannelFieldNumberProps(base as never, state);
  // RA: the channel name is the default aria-label while no Label renders (`useSlot` re-renders with `label: false`).
  const channelName = initialLabel ? untrack(() => channelFieldColorValue(state)).getChannelName(merged.channel!, locale) : undefined;
  const ownAriaLabel = aria.inputProps["aria-label"];
  const input: Record<string, unknown> = {
    ...aria.inputProps,
    // In the literal (a closure assigned onto an object afterwards is not resume-compiled).
    "aria-label": () => (initialLabel && !hasLabel() ? channelName : ownAriaLabel),
    // RA: `name` goes on the hidden input (the number), not the text input.
    name: undefined,
    form: merged.form,
    onCopy: merged.onCopy,
    onCut: merged.onCut,
    onSelect: merged.onSelect,
    onCompositionUpdate: merged.onCompositionUpdate,
    onInput: (e: Event) => numberFieldInput(e, np, numberFieldView(state), aria),
    onChange: (e: Event) => numberFieldChange(e, np, numberFieldView(state)),
    onInvalid: (e: Event) => numberFieldInvalid(e, np, numberFieldView(state)),
    onBeforeInput: (e: InputEvent) => numberFieldBeforeInput(e, np, numberFieldView(state)),
    onCompositionStart: (e: CompositionEvent) => numberFieldCompositionStart(e, np, numberFieldView(state)),
    onCompositionEnd: (e: CompositionEvent) => numberFieldCompositionEnd(e, np, numberFieldView(state)),
    onPaste: (e: ClipboardEvent) => numberFieldPaste(e, np, numberFieldView(state)),
    onKeyDown: (e: KeyboardEvent) => numberFieldKeyDown(e, np, numberFieldView(state), aria),
    onKeyUp: (e: KeyboardEvent) => numberFieldKeyUp(e, np, numberFieldView(state), aria),
    // RA useNumberField: the group's focus-within enables the wheel; RAC ColorField has no group, so the input is it.
    onFocus: (e: FocusEvent) => {
      numberFieldGroupFocusIn(e, np, numberFieldView(state), aria);
      numberFieldFocus(e, np, numberFieldView(state), aria);
    },
    onBlur: (e: FocusEvent) => {
      numberFieldBlur(e, np, numberFieldView(state), aria);
      numberFieldGroupFocusOut(e, np, numberFieldView(state), aria);
    },
  };
  const name = merged.name;
  const hidden = name
    ? {
        name,
        form: merged.form,
        value: () => {
          const v = numberValue(numberFieldView(state));
          return isNaN(v) ? "" : String(v);
        },
      }
    : undefined;
  return renderField({ merged, state, ref, labelRef, hidden, ...wire(merged, aria, input, initialLabel, hasLabel) });
}

function wire(
  merged: ColorFieldProps,
  aria: {
    labelProps: Record<string, unknown>;
    ids: { fieldProps: Record<string, unknown> };
    descriptionProps: Record<string, unknown>;
    errorMessageProps: Record<string, unknown>;
    isInvalid: () => boolean;
    validationErrors: () => string[];
    validationDetails: () => ValidationResult["validationDetails"];
  },
  input: Record<string, unknown>,
  initialLabel: boolean,
  hasLabel: () => boolean,
) {
  const { isInvalid, validationErrors, validationDetails } = aria;
  // RA useSlotId: the description / error ids are described-by while their part renders.
  // RA useField deps: the parts re-check when the validity changes (FieldError renders only while invalid).
  const descriptionId = createSlotId((aria.descriptionProps.id as string | undefined) ?? undefined, isInvalid);
  const errorId = createSlotId(aria.errorMessageProps.id as string, isInvalid);
  const extraDescribedBy = merged["aria-describedby"];
  const labelledBy = aria.ids.fieldProps["aria-labelledby"] as string | undefined;
  const ownLabelledBy = merged["aria-labelledby"];
  return {
    labelProps: aria.labelProps,
    input: {
      ...input,
      // Unconditional arrow (a conditional arrow is not resume-compiled).
      "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
      "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorId, isInvalid()), extraDescribedBy].filter(Boolean).join(" ") || undefined,
    },
    descriptionId,
    errorId,
    isInvalid,
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };
}

function renderField(parts: Parts) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const { merged, state, ref, labelProps, labelRef, input, descriptionId, errorId, isInvalid, validation, hidden } = parts;
  // Live props (P5): a live flag is an accessor (read in bindings).
  const isDisabled = merged.isDisabled || false;
  const isReadOnly = merged.isReadOnly || false;
  const isRequired = merged.isRequired || false;
  const channel = merged.channel || "hex";
  const renderValues: ColorFieldRenderProps = {
    state,
    channel,
    isDisabled: () => !!read(isDisabled),
    isInvalid,
    isReadOnly: () => !!read(isReadOnly),
    isRequired: () => !!read(isRequired),
  };
  const rp = renderPropsOf<ColorFieldRenderProps>(merged, { values: renderValues, defaultClassName: "rv-ColorField" });
  // The flags go through the spread bag (an accessor while live: a function attribute value outside a spread is not a
  // server binding, and an explicit attribute after the spread would override the bag's key); none is added while
  // all are off (static).
  const disabledAttr = flagAttr(isDisabled);
  const readOnlyAttr = flagAttr(isReadOnly);
  const requiredAttr = flagAttr(isRequired);
  const flags =
    disabledAttr || readOnlyAttr || requiredAttr ? { "data-disabled": disabledAttr, "data-readonly": readOnlyAttr, "data-required": requiredAttr } : undefined;
  const dom = flags ? liveAssign(globalDOMProps(merged, OWNED), flags) : globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const values: ProviderValue<any>[] = [
    [ColorFieldStateContext, state],
    [InputContext, input],
    [LabelContext, { ...labelProps, ref: labelRef }],
    [GroupContext, { role: "presentation", isInvalid, isDisabled }],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [FieldErrorContext, validation],
  ];
  const children = rp.children;
  // Rivet (server): the input renders before its Description / FieldError: probe which slotted parts render (as TextField).
  if (typeof document === "undefined") probeSlots(values, () => children());
  const hiddenName = hidden?.name;
  const hiddenForm = hidden?.form;
  const hiddenValue = hidden?.value;
  if (merged.render)
    return (
      <>
        {merged.render(
          {
            ...dom,
            ref: ref as never,
            class: () => rp.class(),
            style: () => rp.style(),
            slot,
            "data-channel": channel,
            "data-disabled": disabledAttr,
            "data-invalid": () => isInvalid() || undefined,
            "data-readonly": readOnlyAttr,
            "data-required": requiredAttr,
            children: () => <Provider values={values}>{children()}</Provider>,
          } as never,
          renderValues,
        )}
        {hiddenValue ? <input type="hidden" name={hiddenName} form={hiddenForm} value={hiddenValue()} /> : null}
      </>
    );
  return (
    <>
      <div {...dom} ref={ref as never} class={rp.class()} style={rp.style()} slot={slot} data-channel={channel} data-invalid={isInvalid() || undefined}>
        <Provider values={values}>{children()}</Provider>
      </div>
      {hiddenValue ? <input type="hidden" name={hiddenName} form={hiddenForm} value={hiddenValue()} /> : null}
    </>
  );
}
