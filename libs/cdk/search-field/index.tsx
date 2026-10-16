// Ported from react-aria-components SearchField (packages/react-aria-components/src/SearchField.tsx), Apache-2.0, © Adobe.
// A search field allows a user to enter and clear a search query.
// Rivet:
// - composed from parts like RAC: `<SearchField><Label/><Input/><Button/><Text slot="description"/><FieldError/></SearchField>`;
//   provides `LabelContext`, `InputContext`, `ButtonContext` (the clear button), `TextContext`
//   (description / errorMessage slots), `GroupContext`, `FieldErrorContext`.
// - merges `SearchFieldContext`, then `FieldInputContext` (an enclosing `<Autocomplete>`: value accessor,
//   `onChange`, virtual-focus key handling, `aria-activedescendant` / `aria-controls` accessors, input ref).
// - `value`: plain = controlled, Signal = two-way, accessor = controlled read live (`state/search-field.ts`).
// - input bags hold accessors (`value`, `aria-invalid`, `aria-describedby`, `aria-labelledby`); render props
//   are accessors (`class={({ isEmpty }) => (isEmpty() ? "empty" : "")}`), `state` is the SearchFieldState.
// - description / error ids are slot ids (RA `useSlotId`): part of `aria-describedby` while that part renders (server: a slot
//   probe, `probeSlots`, marks them before the input renders, as Select / TextField).
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, SearchFieldRenderProps)` instead of the default `<div>`.
import { isHidden } from "../collections/components.tsx";
import { probeSlots, slotProbing } from "#server";
import { createContext, untrack } from "@rivetjs/reactivity";
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import { formValidationBehavior, formValidationErrors } from "../form/index.tsx";
import { FieldErrorContext } from "../form/field-error.tsx";
import { LabelContext } from "../label/index.tsx";
import { InputContext } from "../input/index.tsx";
import { TextContext } from "../text/index.tsx";
import { ButtonContext } from "../button/index.tsx";
import { GroupContext } from "../group/index.tsx";
import { FieldInputContext } from "../autocomplete/contexts.ts";
import { useLocale } from "../i18n/index.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  Provider,
  resumableContext,
  contextProps,
  createSlot,
  createSlotId,
  slotIdRef,
  type ContextValue,
  type ProviderValue,
  type RACValidation,
  type RefValue,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { createSearchFieldState, searchFieldValue, type SearchFieldState } from "../state/search-field.ts";
import { searchFieldProps, type AriaSearchFieldProps } from "./behaviour.tsx";
import { hasLive, liveOptions, liveWithoutData } from "../utils/live.tsx";
import { renderPropsOf } from "../slots/index.tsx";

export type { SearchFieldState } from "../state/search-field.ts";
export type { AriaSearchFieldProps } from "./behaviour.tsx";

export interface SearchFieldRenderProps {
  /**
   * Whether the search field is empty.
   *
   * @selector [data-empty]
   */
  isEmpty: () => boolean;
  /**
   * Whether the search field is disabled.
   *
   * @selector [data-disabled]
   */
  isDisabled: () => boolean;
  /**
   * Whether the search field is invalid.
   *
   * @selector [data-invalid]
   */
  isInvalid: () => boolean;
  /**
   * Whether the search field is read only.
   *
   * @selector [data-readonly]
   */
  isReadOnly: () => boolean;
  /**
   * Whether the search field is required.
   *
   * @selector [data-required]
   */
  isRequired: () => boolean;
  /** State of the search field. */
  state: SearchFieldState;
}

export interface SearchFieldProps
  extends
    Omit<
      AriaSearchFieldProps,
      "label" | "placeholder" | "description" | "errorMessage" | "validationBehavior" | "validationErrors" | "inputElementType" | "locale"
    >,
    RACValidation,
    RenderProps<SearchFieldRenderProps>,
    SlotProps,
    DOMRenderProps<"div", SearchFieldRenderProps>,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "onInput" | "onBeforeInput"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-SearchField'
   */
  class?: RenderProps<SearchFieldRenderProps>["class"];
  /** Whether the value is invalid (a value, or an accessor that stays live). */
  isInvalid?: MaybeAccessor<boolean | undefined>;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `SearchFieldContext`. */
export const SearchFieldContext = resumableContext(createContext<ContextValue<SearchFieldProps, HTMLDivElement>>(null, { id: "rv-search-field" }));

const OWNED = ["style", "render"] as const;

/** A search field allows a user to enter and clear a search query. */
export function SearchField(props: SearchFieldProps) {
  // RAC createHideableComponent: nothing inside a parent's collection build pass.
  if (isHidden()) return null;
  // Live props (P5): live state / attribute keys become accessors at the boundary (as TextField), `value` is controlled
  // (an accessor only when defined at creation); class / style / children from a live view; body untracked.
  return untrack(() => searchField(props));
}

/** Live by default (LIVE-SWEEP): every attribute-like prop; read once: `id`, `name`, `aria-label` / `aria-labelledby`,
 *  `autoFocus`, `defaultValue`, `validationBehavior`, `validate`, handlers. */
const LIVE_KEYS = [
  "isDisabled",
  "isReadOnly",
  "isRequired",
  "isInvalid",
  "type",
  "placeholder",
  "pattern",
  "maxLength",
  "minLength",
  "autoComplete",
  "autoCapitalize",
  "autoCorrect",
  "spellCheck",
  "inputMode",
  "enterKeyHint",
  "form",
  "excludeFromTabOrder",
  "aria-describedby",
  "aria-details",
  "aria-errormessage",
  "aria-controls",
  "aria-activedescendant",
  "aria-autocomplete",
  "aria-haspopup",
] as const;

function searchField(props: SearchFieldProps) {
  // Inside another field's server slot probe (`probeSlots`): this field's subtree holds none of that field's slots.
  if (slotProbing) return null;
  const [own, ref] = contextProps(props, props.ref, SearchFieldContext);
  const validationBehavior = formValidationBehavior(own.validationBehavior);
  const [ctxMerged, fieldInputRef] = contextProps(own as SearchFieldProps, undefined, FieldInputContext) as unknown as [
    SearchFieldProps,
    Ref<HTMLInputElement> | undefined,
  ];
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, LIVE_KEYS as never, ["value"]) : ctxMerged;
  const inputRef: Ref<HTMLInputElement> = fieldInputRef ?? createRef<HTMLInputElement>();
  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  const state = createSearchFieldState({ value: merged.value, defaultValue: merged.defaultValue, onChange: merged.onChange });

  const { labelProps, inputProps, clearButtonProps, descriptionProps, errorMessageProps, ids, isInvalid, validationErrors, validationDetails } =
    searchFieldProps(
      {
        ...(liveWithoutData(merged) as SearchFieldProps),
        label: initialLabel,
        validationBehavior,
        validationErrors: formValidationErrors(),
        locale: useLocale().locale,
      },
      state,
      inputRef,
    );

  // RA useSlotId: the description / error ids are described-by while their part renders.
  const descriptionId = createSlotId((descriptionProps.id as string | undefined) ?? (merged.id ? merged.id + "-description" : undefined));
  // The error part renders while invalid: re-check its id when that changes.
  const errorId = createSlotId(errorMessageProps.id as string, isInvalid);
  const extraDescribedBy = merged["aria-describedby"] as MaybeAccessor<string | undefined>;
  const labelledBy = ids.fieldProps["aria-labelledby"];
  const ownLabelledBy = merged["aria-labelledby"];
  const input = {
    ...inputProps,
    "aria-labelledby": () => (!initialLabel || hasLabel() ? labelledBy : ownLabelledBy),
    // Ids of the parts that render; server: marked by the slot probe below (a resumed page never re-renders).
    "aria-describedby": () => [slotIdRef(descriptionId, false), slotIdRef(errorId, isInvalid()), read(extraDescribedBy)].filter(Boolean).join(" ") || undefined,
    ref: inputRef,
  };

  const isEmpty = () => searchFieldValue(state) === "";
  const disabledProp = merged.isDisabled as MaybeAccessor<boolean | undefined>;
  const readOnlyProp = merged.isReadOnly as MaybeAccessor<boolean | undefined>;
  const isDisabled = () => !!read(disabledProp);
  const isReadOnly = () => !!read(readOnlyProp);
  const requiredProp = merged.isRequired as MaybeAccessor<boolean | undefined>;
  const isRequired = () => !!read(requiredProp);
  const renderValues = { isEmpty, isDisabled, isInvalid, isReadOnly, isRequired, state };
  const rp = renderPropsOf(merged, {
    values: renderValues,
    defaultClassName: "rv-SearchField",
  });
  // Object-literal function value (R2 resumable symbol, as TextField's): with a plain const arrow the FieldError of
  // a resumed SearchField never saw the validation.
  const fieldError = {
    validation: (): ValidationResult => ({ isInvalid: isInvalid(), validationErrors: validationErrors(), validationDetails: validationDetails() }),
  };

  const dom = globalDOMProps(merged, OWNED);
  delete dom.id;
  const slot = merged.slot || undefined;
  const values: ProviderValue<any>[] = [
    [LabelContext, { ...labelProps, ref: labelRef }],
    [InputContext, input],
    [ButtonContext, clearButtonProps],
    [TextContext, { slots: { description: { id: descriptionId }, errorMessage: { id: errorId } } }],
    [GroupContext, { isInvalid, isDisabled: disabledProp }],
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
        "data-empty": () => dataBool(isEmpty()),
        "data-disabled": () => dataBool(isDisabled()),
        "data-invalid": () => dataBool(isInvalid()),
        "data-readonly": () => dataBool(isReadOnly()),
        "data-required": () => dataBool(isRequired()),
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
      data-empty={dataBool(isEmpty())}
      data-disabled={dataBool(isDisabled())}
      data-invalid={dataBool(isInvalid())}
      data-readonly={dataBool(isReadOnly())}
      data-required={dataBool(isRequired())}
    >
      <Provider values={values}>{rp.children()}</Provider>
    </div>
  );
}
