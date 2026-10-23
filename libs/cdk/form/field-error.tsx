// Ported from react-aria-components `FieldError` (packages/react-aria-components/src/FieldError.tsx), Apache-2.0, © Adobe.
// A FieldError displays validation errors for a form field.
// Rivet:
// - `FieldErrorContext` is resumable (`rv-field-error`); fields provide their validation as an accessor
//   (`() => displayValidation(state.validation)`) or a plain `ValidationResult`.
// - nothing renders while the field is valid (or the children resolve to `null`): a `<Show>` region, so a
//   field turning invalid on the client mounts the `<Text slot="errorMessage">` (its slot id puts the
//   error id in the field's `aria-describedby` while it renders).
// - render props are accessors (`{({ validationErrors }) => validationErrors().join(", ")}`); `class` / `style`
//   may be functions of them (RAC `className` → `class`).
// - `render` (RAC DOMRenderProps) is forwarded to the `Text` element it renders (`render(attrs, undefined)`), so it only runs while there is an error.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { read, type MaybeAccessor, type ValidationResult } from "../state/form-validation.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { type RefValue, type ClassNameOrFunction, type RenderProps } from "../slots/index.tsx";
import { isSlot } from "@rivetjs/runtime/slot";
import { type DOMRenderProps } from "../utils/render.ts";
import { Text } from "../text/index.tsx";
import { renderPropsOf } from "../slots/index.tsx";
import { slotProbing } from "#server";

/** RAC `FieldErrorContext`: the validation of the enclosing field (`null` outside a field). */
export const FieldErrorContext = createContext<MaybeAccessor<ValidationResult | null> | null>(null);

/** RAC `FieldErrorRenderProps` (= `ValidationResult`), as accessors. */
export interface FieldErrorRenderProps {
  /** Whether the input value is invalid. */
  isInvalid: () => boolean;
  /** The current error messages for the input if it is invalid, otherwise an empty array. */
  validationErrors: () => string[];
  /** The native validation details for the input. */
  validationDetails: () => ValidationState;
}

type ValidationState = ValidationResult["validationDetails"];

export interface FieldErrorProps
  extends RenderProps<FieldErrorRenderProps>, DOMRenderProps<"span", undefined>, Omit<GlobalDOMAttributes<HTMLElement>, "style"> {
  /** The element's unique identifier. */
  id?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-FieldError'
   */
  class?: ClassNameOrFunction<FieldErrorRenderProps>;
  /**
   * The HTML element type to render. Set to `'div'` when using block-level children (e.g. `<ul>`).
   *
   * @default 'span'
   */
  elementType?: string;
  ref?: RefValue<HTMLElement>;
}

const OWNED = ["style", "class", "children", "elementType", "ref", "render"] as const;

/**
 * A FieldError displays validation errors for a form field.
 */
export function FieldError(props: FieldErrorProps) {
  // A field's server slot probe (`probeSlots`): nothing to mark — owners keep the error id while invalid
  // (`slotIdRef(errorId, isInvalid())`, RAC FieldError renders only then).
  if (slotProbing) return null;
  const context = useContext(FieldErrorContext);
  const validation = (): ValidationResult | null => read(context ?? null);
  const values: FieldErrorRenderProps = {
    isInvalid: () => validation()?.isInvalid ?? false,
    validationErrors: () => validation()?.validationErrors ?? [],
    validationDetails: () => validation()!.validationDetails,
  };
  const rp = renderPropsOf(props, {
    defaultClassName: "rv-FieldError",
    values,
  });
  const defaultChildren = () => {
    const errors = values.validationErrors();
    return errors.length === 0 ? undefined : errors.join(" ");
  };
  // RAC: no error → nothing; children resolving to null → nothing.
  const content = () => {
    if (!values.isInvalid()) return null;
    // Plain JSX children are a compiler slot: one resolving to `undefined` (`{cond ? msg : undefined}`) is RAC's
    // `children == null` → the default children (a render-function child returning null still renders nothing).
    const children = props.children === undefined ? defaultChildren() : (rp.children() ?? (isSlot(props.children) ? defaultChildren() : undefined));
    return children == null ? null : { children };
  };
  const dom = globalDOMProps(props, OWNED);
  const id = props.id;
  const elementType = props.elementType;
  const ref = props.ref;
  const render = props.render;
  return (
    <Show when={content}>
      {(get: () => { children: unknown } | null) => (
        <Text {...dom} slot="errorMessage" id={id} elementType={elementType} ref={ref} render={render} class={rp.class()} style={rp.style()}>
          {() => get()?.children as never}
        </Text>
      )}
    </Show>
  );
}
