// Rivet (identity T20): what a `<Form form>` (`@rivetjs/forms` store) tells the ui fields inside it, with no forms import
// here (fields stay zero-cost): `defaultValue(name)` = the store's echoed / initial value for a field name (a failed no-JS
// post re-renders the values the user sent); `submitting()` = the store's submit in flight (submit Buttons' `isPending`). Resumable (`rv-ui-form-fields`): the value is a closure over the store.
import { createContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";

export interface FormFields {
  /** Server-side default of the field `name` (echo after a failed post, else the form's `initial`). */
  defaultValue: (name: string) => string | undefined;
  /** Whether the form's submit is in flight (reactive). */
  submitting: () => boolean;
}

export const FormFieldsContext = resumableContext(createContext<FormFields | undefined>(undefined, { id: "rv-ui-form-fields" }));
