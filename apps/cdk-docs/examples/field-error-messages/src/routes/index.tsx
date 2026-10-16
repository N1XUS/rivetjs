import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { DEFAULT_VALIDATION_RESULT, getValidationResult } from "@rivetjs/cdk/state/form-validation";

export const head = { title: "FieldError messages" };

// #region demo
export default function Messages() {
  const broken = signal(false);
  const field = { validation: () => (broken() ? getValidationResult(["Too short.", "Needs a digit."])! : DEFAULT_VALIDATION_RESULT) };
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <div class="flex gap-2">
        <Button id="fe-break" onPress={() => broken.set(true)}>
          Make invalid
        </Button>
        <Button id="fe-fix" onPress={() => broken.set(false)}>
          Make valid
        </Button>
      </div>
      <Provider token={FieldErrorContext} value={field.validation}>
        {/* Default content: the errors joined by a space. */}
        <FieldError id="fe-default" />
        <FieldError id="fe-static">Check the password rules.</FieldError>
        {/* Render props are accessors; returning null renders nothing. */}
        <FieldError id="fe-fn">{({ validationErrors }) => `${validationErrors().length} problem(s): ${validationErrors().join(" ")}`}</FieldError>
      </Provider>
    </section>
  );
}
// #endregion
