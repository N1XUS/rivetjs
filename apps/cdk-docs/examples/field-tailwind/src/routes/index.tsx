import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { Label, Text, describedBy, fieldProps } from "@rivetjs/cdk/label";
import { DEFAULT_VALIDATION_RESULT, getValidationResult } from "@rivetjs/cdk/state/form-validation";

export const head = { title: "Field parts with Tailwind" };

// #region demo
export default function AgeField() {
  const age = signal("");
  const ids = fieldProps({ id: "tw-age", label: true, description: true });
  const field = { validation: () => getValidationResult(age() && Number(age()) < 18 ? ["You must be 18 or older."] : []) ?? DEFAULT_VALIDATION_RESULT };
  return (
    <div class="m-4 grid max-w-xs gap-1">
      <Label id={ids.labelProps.id} for={ids.labelProps.for} class="text-sm font-medium text-slate-700">
        Age
      </Label>
      <input
        id={ids.fieldProps.id}
        inputMode="numeric"
        class="rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/40 aria-invalid:border-red-600"
        aria-labelledby={ids.fieldProps["aria-labelledby"]}
        aria-describedby={describedBy(ids, field.validation().isInvalid)}
        aria-invalid={field.validation().isInvalid ? "true" : undefined}
        value={age()}
        onInput={(event) => age.set(event.currentTarget.value)}
      />
      <Text id={ids.descriptionId} slot="description" class="text-xs text-slate-500">
        In years.
      </Text>
      <Provider token={FieldErrorContext} value={field.validation}>
        <FieldError id={ids.errorMessageId} class="text-xs font-medium text-red-700" />
      </Provider>
    </div>
  );
}
// #endregion
