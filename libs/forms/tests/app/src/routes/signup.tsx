import { redirect, actions } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { autofocus, createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onBlur, onInput, onSubmit, submitting, validating } from "@rivetjs/forms";
import { ErrorSummary, FieldError } from "@rivetjs/forms/components";
import { action } from "@rivetjs/forms/server";
import { signupForm } from "../forms/definitions.js";

export const head = { title: "Sign up" };

export const forms = actions({
  signup: action(signupForm, () => redirect("/welcome")),
});

/**
 * Resumed form: server-rendered, works without JavaScript (POST → 400 page with issues and echoed
 * values), enhanced once a handler runs (fetch submit, issues on blur, async email check).
 */
export default function SignupPage() {
  const form = createForm(signupForm, { result: actionResult() });
  const input = "input";
  return (
    <section aria-labelledby="signup-title">
      <h1 id="signup-title">
        Sign up
      </h1>
      <form
        id={formId(form)}
        method="post"
        action="?/signup"
        class="stack"
        aria-busy={submitting(form) ? "true" : undefined}
        onInput={(event) => onInput(signupForm, form, event)}
        onFocusOut={(event) => onBlur(signupForm, form, event)}
        onSubmit={(event) => onSubmit(signupForm, form, event)}
      >
        <ErrorSummary of={form} class="summary" />
        <label for={fieldId(form, "name")} class="label">
          Name
        </label>
        <input id={fieldId(form, "name")} name="name" class={input} autoComplete="name" required value={defaultValue(form, "name")} autoFocus={autofocus(form, "name")} aria-invalid={isInvalid(form, "name")} aria-describedby={describedBy(form, "name")} />
        <FieldError of={form} name="name" class="error" />
        <label for={fieldId(form, "email")} class="label">
          Email
        </label>
        <input id={fieldId(form, "email")} name="email" type="email" class={input} autoComplete="email" required value={defaultValue(form, "email")} autoFocus={autofocus(form, "email")} aria-invalid={isInvalid(form, "email")} aria-describedby={describedBy(form, "email")} />
        <p id="signup-email-checking" class="hint" hidden={validating(form, "email") ? undefined : true}>
          Checking…
        </p>
        <FieldError of={form} name="email" class="error" />
        <label for={fieldId(form, "password")} class="label">
          Password
        </label>
        <input id={fieldId(form, "password")} name="password" type="password" class={input} autoComplete="new-password" required autoFocus={autofocus(form, "password")} aria-invalid={isInvalid(form, "password")} aria-describedby={describedBy(form, "password")} />
        <FieldError of={form} name="password" class="error" />
        <label for={fieldId(form, "confirm")} class="label">
          Confirm password
        </label>
        <input id={fieldId(form, "confirm")} name="confirm" type="password" class={input} autoComplete="new-password" required autoFocus={autofocus(form, "confirm")} aria-invalid={isInvalid(form, "confirm")} aria-describedby={describedBy(form, "confirm")} />
        <FieldError of={form} name="confirm" class="error" />
        <label for={fieldId(form, "age")} class="label">
          Age (optional)
        </label>
        <input id={fieldId(form, "age")} name="age" type="number" class={input} value={defaultValue(form, "age")} autoFocus={autofocus(form, "age")} aria-invalid={isInvalid(form, "age")} aria-describedby={describedBy(form, "age")} />
        <FieldError of={form} name="age" class="error" />
        <button type="submit" class="button">
          Create account
        </button>
      </form>
    </section>
  );
}
