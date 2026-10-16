// Ported from HeroUI v3.2.6 packages/react/src/components/form/form.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `"use client"` dropped; `react-aria-components/Form` → `@rivetjs/cdk/form` (validation behaviour / server errors contexts, `render`).
// - Rivet (identity spec §4.2 item 10, T20): `form` (a `@rivetjs/forms` store) + `definition` join the form to the forms
//   engine: `id` = `formId(form)`, `method="post"`, `action="?/<definition.name>"`, `validationBehavior="aria"`, the
//   delegated handlers (`onInput` / `onFocusOut` → `onBlur` on a `display: contents` wrapper of the children, `onSubmit` / `onInvalid` on the form) and `validationErrors` = the
//   store's shown issues by field name (`fieldIssues`, text via `formatIssue(issue, format)`), so every cdk field with a
//   `name` shows its issues (`isInvalid`, `aria-describedby`, its `FieldError`) with no per-field glue. `FormFieldsContext`
//   (`../../utils/form-fields.ts`, no forms import there) lets fields echo `defaultValue(form, name)` after a failed no-JS post
//   (TextField: also a FieldError in its shorthand form) and submit Buttons take `isPending` from `submitting(form)`. Your own
//   `onSubmit` / `onInvalid` run after the forms ones (`onSubmit` gets the forms result). Without `form` the cdk Form is unchanged.
import { Form as FormPrimitive } from "@rivetjs/cdk/form";
import type { FormProps as FormPrimitiveProps, ValidationErrors } from "@rivetjs/cdk/form";
import { defaultValue, fieldIssues, formatIssue, formId, onBlur, onInput, onInvalid, onSubmit, submitting } from "@rivetjs/forms";
import type { Form as FormStore, FormDefinition, Issue } from "@rivetjs/forms";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import { FormFieldsContext, type FormFields } from "../../utils/form-fields.ts";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Form Root
 * -----------------------------------------------------------------------------------------------*/
interface FormRootProps extends Omit<FormPrimitiveProps, "onSubmit"> {
  /** Rivet: a `@rivetjs/forms` store (`createForm(definition, …)`); needs `definition`. */
  form?: FormStore<any>;
  /** Rivet: the form definition (`defineForm`, module scope) the store was created from. */
  definition?: FormDefinition<any>;
  /** Rivet: issue → message (i18n); default: the issue's message, else its key. */
  format?: (issue: Issue) => string;
  /** With `form`: called after the forms submit with its result (`true` = accepted, see `@rivetjs/forms` `onSubmit`). */
  onSubmit?: (event: SubmitEvent, result?: Promise<boolean> | undefined) => void;
}

const CONTENTS = { display: "contents" };

const FormRoot = (props: FormRootProps): JSX.Element => {
  const form = props.form;
  if (!form) return <FormPrimitive {...(props as FormPrimitiveProps)} />;
  const [local, rest] = splitLive(props, ["children", "definition", "form", "format", "onInvalid", "onSubmit"]);
  const errors = (): ValidationErrors => {
    const out: ValidationErrors = {};
    for (const [path, list] of fieldIssues(form)) out[path] = list.map((issue) => formatIssue(issue, local.format));
    return out;
  };
  const children = local.children;
  // cdk Form forwards no input / focus events (they belong to inputs): a `display: contents` wrapper takes the delegated
  // `input` / `focusout` (the forms handlers find the form from the event target).
  const content = () => (
    <FormPrimitive
      id={formId(form)}
      method="post"
      action={"?/" + local.definition!.name}
      validationBehavior="aria"
      validationErrors={errors}
      {...(rest as FormPrimitiveProps)}
      onInvalid={(event: Event) => {
        onInvalid(local.definition!, form, event);
        local.onInvalid?.(event);
      }}
      onSubmit={(event: SubmitEvent) => {
        const result = onSubmit(local.definition!, form, event);
        local.onSubmit?.(event, result);
      }}
    >
      <div
        style={CONTENTS}
        onInput={(event: InputEvent) => onInput(local.definition!, form, event)}
        onFocusOut={(event: FocusEvent) => onBlur(local.definition!, form, event)}
      >
        {children as Content}
      </div>
    </FormPrimitive>
  );

  const fields: FormFields = { defaultValue: (name: string) => defaultValue(form, name as never), submitting: () => submitting(form) };
  return (
    <Provider token={FormFieldsContext} value={fields}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { FormRoot };

export type { FormRootProps };
