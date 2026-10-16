import { redirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm } from "@rivetjs/forms";
import { action } from "@rivetjs/forms/server";
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { signupForm } from "../forms/definitions.js";

export const head = { title: "Sign up (ui)" };

export const serverActions = {
  signup: action(signupForm, () => redirect("/welcome")),
};

/**
 * `@rivetjs/ui` Form joined to the forms store (`form` + `definition`): named TextFields show their issues and echo
 * their values with no per-field glue. Resumed; works without JavaScript (POST → 400 page with issues and echoed values).
 */
export default function UiSignupPage() {
  const form = createForm(signupForm, { result: actionResult() });
  return (
    <section>
      <h1>Sign up (ui)</h1>
      <Form form={form} definition={signupForm} class="stack">
        <TextField name="name" label="Name" autoComplete="name" />
        <TextField name="email" label="Email" type="email" autoComplete="email" />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" />
        <TextField name="confirm" label="Confirm password" type="password" autoComplete="new-password" />
        <Button type="submit">Create account</Button>
      </Form>
    </section>
  );
}
