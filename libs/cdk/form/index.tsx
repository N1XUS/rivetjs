// Ported from react-aria-components `Form` (packages/react-aria-components/src/Form.tsx), Apache-2.0, © Adobe.
// A form is a group of inputs that allows users to submit data to a server, with support for providing
// field validation errors.
// Rivet:
// - plain JSX children are lazy (the compiler compiles them to a slot evaluated inside the parent,
//   `renderSlot`), so the fields see the Form contexts; a function child `{() => …}` works too.
// - `FormContext` (`rv-form`) and `FormValidationContext` (`rv-form-validation`) are resumable. The form
//   provides `{ validationBehavior }` in `FormContext` (RAC: all of its props): provided values must
//   serialize, and fields only read `validationBehavior`.
// - `onInvalid` is bound in the capture phase (`invalid` does not bubble): it sees each field's `invalid`
//   event before the field's own handler, like React's form `onInvalid`, so `preventDefault()` there
//   keeps the field from focusing itself (RA `useFormValidation`).
// - native mode: fields never interacted with get their custom validity on submit (`formSubmit`, see
//   behaviour.ts) — no layout effect runs before interaction.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, undefined)` instead of the default `<form>`. Deviations: `action` is a URL string (no React form actions).
import { createContext, useContext } from "@rivetjs/reactivity";
import { clientEffect, Provider, ref as createRef } from "@rivetjs/runtime/dom";
import { renderSlot } from "@rivetjs/runtime/slot";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { MaybeAccessor, ValidationBehavior, ValidationErrors } from "../state/form-validation.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { resumableContext, contextProps, mergeRefValues, slottedContext, type ContextValue, type RefValue, type SlotProps } from "../slots/index.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { applyPendingValidity, formSubmit } from "./behaviour.ts";
import { isLive, liveAssign, liveClass } from "../utils/live.tsx";

export type { ValidationBehavior, ValidationErrors, ValidationResult, ValidationFunction } from "../state/form-validation.ts";
export { FieldError, FieldErrorContext, type FieldErrorProps, type FieldErrorRenderProps } from "./field-error.tsx";

/** `@react-types/shared` `FormProps` + RAC `FormProps`. */
export interface FormProps extends GlobalDOMAttributes<HTMLFormElement>, SlotProps, DOMRenderProps<"form", undefined> {
  /**
   * Validation errors for the form, typically returned by a server.
   * This should be set to an object mapping from input names to errors (object, signal or accessor).
   */
  validationErrors?: MaybeAccessor<ValidationErrors | undefined>;
  /**
   * Whether to use native HTML form validation to prevent form submission
   * when a field value is missing or invalid, or mark fields as required
   * or invalid via ARIA.
   *
   * @default 'native'
   */
  validationBehavior?: ValidationBehavior;
  /** Where to send the form-data when the form is submitted. */
  action?: string;
  /** The HTTP method to submit the form with. */
  method?: "get" | "post" | "dialog";
  /** The encoding type when the form is submitted. */
  encType?: "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain";
  /** Where to display the response after submitting the form. */
  target?: "_blank" | "_self" | "_parent" | "_top" | (string & {});
  /** Indicates whether input elements can by default have their values automatically completed by the browser. */
  autoComplete?: "off" | "on";
  /** Controls whether inputted text is automatically capitalized and, if so, in what manner. */
  autoCapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  /** An ARIA role override for the form element. */
  role?: "search" | "presentation";
  /** The form's name. */
  name?: string;
  /** The element's unique identifier. */
  id?: string;
  /**
   * The CSS class for the element.
   *
   * @default 'rv-Form'
   */
  class?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /** Triggered when a user submits the form (after pending field validity was applied and the form is valid). */
  onSubmit?: (event: SubmitEvent) => void;
  /** Triggered when a user resets the form. */
  onReset?: (event: Event) => void;
  /** Triggered for each invalid field when a user submits the form; `preventDefault()` keeps the first invalid field from focusing. */
  onInvalid?: (event: Event) => void;
  ref?: RefValue<HTMLFormElement>;
  /** The children of the form. */
  children?: Content | (() => Content);
}

/** RAC `FormContext`: props for a `<Form>` inside; the `<Form>` provides `{ validationBehavior }` to its fields. */
export const FormContext = resumableContext(createContext<ContextValue<FormProps, HTMLFormElement>>(null, { id: "rv-form" }));

/** RAC `FormValidationContext` (react-stately): server errors per field name. */
export const FormValidationContext = resumableContext(
  createContext<MaybeAccessor<ValidationErrors | undefined> | undefined>(undefined, { id: "rv-form-validation" }),
);

/** Validation behaviour of a field: its own prop, else the enclosing `<Form>`'s, else "native" (RAC fields). */
export function formValidationBehavior(own: ValidationBehavior | undefined): ValidationBehavior {
  return own ?? slottedContext(FormContext)?.validationBehavior ?? "native";
}

/** Server errors of the enclosing `<Form>` (accessor or object), if any (RS `useContext(FormValidationContext)`). */
export function formValidationErrors(): MaybeAccessor<ValidationErrors | undefined> | undefined {
  return useContext(FormValidationContext);
}

/** @deprecated migration shim — remove when no importer (use `formValidationBehavior`). */
export const useValidationBehavior = formValidationBehavior;
/** @deprecated migration shim — remove when no importer (use `formValidationErrors`). */
export const useValidationErrors = formValidationErrors;

/**
 * A form is a group of inputs that allows users to submit data to a server,
 * with support for providing field validation errors.
 */
export function Form(props: FormProps) {
  const [merged, ref] = contextProps(props, props.ref, FormContext);
  const { validationErrors, validationBehavior = "native", children, onSubmit, onReset, onInvalid, render } = merged;
  // `autocomplete` / `autocapitalize` are not in the form element typings: spread with the DOM props.
  // Live props (P5): a live `class` goes through the spread as an accessor.
  const className = (isLive(merged, "class") ? liveClass(merged, "rv-Form") : merged.class || "rv-Form") as string;
  const dom = liveAssign(globalDOMProps(merged, ["render"]), { autocomplete: merged.autoComplete, autocapitalize: merged.autoCapitalize, class: className });
  const id = merged.id;
  const slot = merged.slot || undefined;
  const { action, method, encType, target, role, name } = merged;
  const ariaLabel = merged["aria-label"];
  const ariaLabelledby = merged["aria-labelledby"];
  const ariaDescribedby = merged["aria-describedby"];
  const ariaDetails = merged["aria-details"];
  const formValue = { validationBehavior };
  const errors = validationErrors ?? {};
  const formRef = createRef<HTMLFormElement>();
  const formElementRef = mergeRefValues<HTMLFormElement>(formRef, ref);
  if (typeof validationErrors === "function") {
    // RA useFormValidation's layout effect for server errors that change on the client (e.g. after a
    // submit): native mode re-applies every field's `data-rv-error` as custom validity once the
    // bindings settled. Static errors need no effect (applied on submit).
    clientEffect(() => {
      (validationErrors as () => unknown)();
      const form = formRef();
      if (form && !form.noValidate) queueMicrotask(() => applyPendingValidity(form));
    });
  }
  if (render)
    return render(
      {
        ...dom,
        ref: formElementRef as never,
        id,
        class: className,
        slot,
        action,
        method,
        encType,
        target,
        role,
        name,
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledby,
        "aria-describedby": ariaDescribedby,
        "aria-details": ariaDetails,
        noValidate: validationBehavior !== "native" ? true : undefined,
        onSubmit: (event: SubmitEvent) => {
          formSubmit(event);
          if (!event.defaultPrevented && onSubmit) onSubmit(event);
        },
        onReset: (event: Event) => onReset?.(event),
        onInvalidCapture: (event: Event) => onInvalid?.(event),
        children: () => (
          <Provider token={FormContext} value={formValue}>
            <Provider token={FormValidationContext} value={errors}>
              {renderSlot(children)}
            </Provider>
          </Provider>
        ),
      } as never,
      undefined,
    );
  return (
    <form
      {...dom}
      ref={formElementRef as never}
      id={id}
      slot={slot}
      action={action}
      method={method}
      encType={encType}
      target={target}
      role={role}
      name={name}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-describedby={ariaDescribedby}
      aria-details={ariaDetails}
      noValidate={validationBehavior !== "native" ? true : undefined}
      onSubmit={(event) => {
        formSubmit(event);
        if (!event.defaultPrevented && onSubmit) onSubmit(event);
      }}
      onReset={(event) => onReset?.(event)}
      onInvalidCapture={(event) => onInvalid?.(event)}
    >
      <Provider token={FormContext} value={formValue}>
        <Provider token={FormValidationContext} value={errors}>
          {renderSlot(children)}
        </Provider>
      </Provider>
    </form>
  );
}
