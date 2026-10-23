// Ported from react-aria-components `Label`, `FieldError` (packages/react-aria-components/src/Label.tsx,
// FieldError.tsx), Apache-2.0, © Adobe. `Text` lives in `../text/` (re-exported here).
// Rivet: `Label` merges its props with `LabelContext` (`contextProps`): fields provide
// `{ id, for, elementType }` from `fieldAria` (`<TextField><Label>…</Label><Input/></TextField>`).
// `label` / `span` are compiled branches, other `elementType`s render through `Dynamic`.
// `render` (RAC DOMRenderProps): given, the attributes object goes to `render(attrs, undefined)`; the default path is the compiled element. Deviations: not a hideable collection component; `FieldError` (until it moves to
// `../form/field-error.tsx`) keeps its node with `hidden` while there is no error.
import { createContext, untrack } from "@rivetjs/reactivity";
import { Dynamic } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import type { ValidationResult } from "../state/form-validation.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { slotChildren, type DOMRenderProps } from "../utils/render.ts";
import {
  contextProps,
  markSlotRendered,
  slottedContext,
  type ContextValue,
  type HTMLProps,
  type RefValue,
  type SlotProps,
  type StyleObject,
} from "../slots/index.tsx";
import { isHiddenPart } from "../collections/hidden.ts";
import { slotProbing } from "#server";
import { hasLive } from "../utils/live.tsx";
import { liveElement } from "../utils/live-element.tsx";

export {
  fieldProps,
  labelProps,
  labelsProps,
  fieldAria,
  labelAria,
  labelsAttrs,
  describedBy,
  type FieldIds,
  type FieldAriaProps,
  type LabelAria,
  type LabelAriaProps,
} from "./behaviour.ts";
export { Text, TextContext, type TextProps } from "../text/index.tsx";

export interface LabelProps extends HTMLProps<"label">, SlotProps, DOMRenderProps<"label", undefined> {
  /** @default "rv-Label" */
  class?: string;
  style?: StyleObject;
  /** @default "label" */
  elementType?: string;
  ref?: RefValue<HTMLLabelElement>;
  /** Content; a function (not lazy JSX) is reactive content, rendered in a binding (e.g. a context-provided `children: () => title`). */
  children?: Content | (() => Content);
}

export const LabelContext = createContext<ContextValue<LabelProps, HTMLLabelElement>>({});

export function Label(props: LabelProps) {
  // RAC createHideableComponent: nothing in the collection build pass (its context providers are absent).
  if (slotProbing || isHiddenPart()) return null;
  const [merged, ref] = contextProps(props, props.ref, LabelContext);
  // Server: an owner's `createSlot` (rendering after this Label) sees the label (RAC useSlot's ref callback).
  if (typeof document === "undefined") markSlotRendered((slottedContext(LabelContext, props.slot) as { ref?: unknown } | null)?.ref);
  // Live props (P5): class / style / children live (one `Dynamic` element); `elementType` read once.
  if (hasLive(merged)) {
    const live = untrack(() => (merged.render ? null : ((merged.elementType as string | undefined) ?? "label")));
    if (live) return untrack(() => liveElement(merged as never, ref, live, "rv-Label"));
  }
  const { elementType = "label", children, class: className, style, slot, render, ...labelProps } = merged as LabelProps & Record<string, unknown>;
  const cls = className ?? "rv-Label";
  const s = slot ?? undefined;
  const r = ref as never;
  if (render)
    return render(
      {
        ...labelProps,
        style: (typeof style === "function" ? (style as () => StyleObject)() : style) as never,
        slot: s,
        ref: r,
        class: cls,
        children: slotChildren(children),
      } as never,
      undefined,
    );
  if (elementType === "label")
    return (
      <label {...labelProps} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </label>
    );
  if (elementType === "span")
    return (
      <span {...(labelProps as {})} style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never} slot={s} ref={r} class={cls}>
        {renderSlot(children)}
      </span>
    );
  return (
    <Dynamic
      component={elementType}
      {...labelProps}
      style={(typeof style === "function" ? (style as () => StyleObject)() : style) as never}
      slot={s}
      ref={r}
      class={cls}
    >
      {renderSlot(children)}
    </Dynamic>
  );
}

/** `hidden` is FieldError's own (shown only while there is an error); `style` is bound explicitly (element spread rejects `style`). */
const FIELD_ERROR_OWNED = ["hidden", "style"] as const;

export interface FieldErrorProps extends Omit<GlobalDOMAttributes<HTMLSpanElement>, "hidden"> {
  id?: string;
  /** Validation of the field (read by bindings). */
  validation: () => ValidationResult;
  /** Whether the error part shows (default: `validation().isInvalid`); hidden otherwise. */
  hasError?: () => boolean;
  /** Message: static content, a function of the validation, or (default) the validation errors joined by a space. */
  errorMessage?: Content | ((validation: ValidationResult) => Content);
  /** @default "rv-FieldError" */
  class?: string;
}

/**
 * RAC `FieldError`: error message of a field, `hidden` while there is nothing to show (RAC renders
 * nothing; Rivet keeps the node so the id relation and bindings stay in place).
 */
export function FieldError(props: FieldErrorProps) {
  const { errorMessage, validation } = props;
  const shown = props.hasError ?? (() => validation().isInvalid);
  // Read props before the JSX: the spread element resumes as one binding (see Button).
  const dom = globalDOMProps(props, FIELD_ERROR_OWNED);
  const id = props.id;
  const className = props.class ?? "rv-FieldError";
  const style = (props as { style?: StyleObject }).style;
  if (typeof errorMessage === "function")
    return (
      <span {...dom} style={style as never} id={id} class={className} data-slot="errorMessage" hidden={shown() ? undefined : true}>
        {errorMessage(validation())}
      </span>
    );
  if (errorMessage != null)
    return (
      <span {...dom} style={style as never} id={id} class={className} data-slot="errorMessage" hidden={shown() ? undefined : true}>
        {errorMessage}
      </span>
    );
  return (
    <span {...dom} style={style as never} id={id} class={className} data-slot="errorMessage" hidden={shown() ? undefined : true}>
      {validation().validationErrors.join(" ")}
    </span>
  );
}
