import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { Label, Text, describedBy, fieldProps } from "@rivetjs/cdk/label";
import { DEFAULT_VALIDATION_RESULT, getValidationResult } from "@rivetjs/cdk/state/form-validation";

export const head = { title: "Custom field from Label, Text and FieldError" };

// #region demo
export default function SlugField() {
  const slug = signal("");
  // Ids derive from the explicit id: slug-label, slug-description, slug-error.
  const ids = fieldProps({ id: "slug", label: true, description: true });
  const field = {
    validation: () => getValidationResult(/^[a-z-]*$/.test(slug()) ? [] : ["Lowercase letters and dashes only."]) ?? DEFAULT_VALIDATION_RESULT,
  };
  return (
    <div class="m-4 grid max-w-sm gap-1 text-sm">
      <Label id={ids.labelProps.id} for={ids.labelProps.for}>
        Slug
      </Label>
      <input
        id={ids.fieldProps.id}
        class="rounded border border-slate-300 px-2 py-1"
        aria-labelledby={ids.fieldProps["aria-labelledby"]}
        // The error id joins aria-describedby only while there is an error.
        aria-describedby={describedBy(ids, field.validation().isInvalid)}
        aria-invalid={field.validation().isInvalid ? "true" : undefined}
        value={slug()}
        onInput={(event) => slug.set(event.currentTarget.value)}
      />
      <Text id={ids.descriptionId} slot="description" class="text-xs text-slate-500">
        Used in the page URL.
      </Text>
      {/* FieldError reads the validation from FieldErrorContext (the field components provide it). */}
      <Provider token={FieldErrorContext} value={field.validation}>
        <FieldError id={ids.errorMessageId} class="text-xs text-red-700" />
      </Provider>
    </div>
  );
}
// #endregion
