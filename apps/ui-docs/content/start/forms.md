---
title: Forms
description: "Join @rivetjs/ui fields to a @rivetjs/forms form: issues, echoed values and pending submit buttons by field name, with and without JavaScript."
template: guide
status: experimental
related: [components/form, components/text-field, components/button]
---

`@rivetjs/forms` holds a form's schema, timing and issues; `@rivetjs/ui` fields render them. Give the ui `Form` the store and its definition, and give each field a `name`. There is no per-field wiring.

## Define the form

Define the form once, at module scope, with a [Standard Schema](https://standardschema.dev) (Zod, Valibot, ArkType or hand-written). Pages and server actions import it.

```ts
// src/forms/definitions.ts
import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const signupForm = defineForm({
  name: "signup",
  schema: z.object({ name: z.string().min(1, "Enter your name"), email: z.string().email("Enter an email address") }),
  validateOn: "blur",
});
```

## Render it

```tsx
// src/routes/signup.tsx
import { redirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm } from "@rivetjs/forms";
import { action } from "@rivetjs/forms/server";
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";
import { TextField } from "@rivetjs/ui/textfield";
import { signupForm } from "../forms/definitions.ts";

export const serverActions = {
  signup: action(signupForm, () => redirect("/welcome")),
};

export default function SignupPage() {
  const form = createForm(signupForm, { result: actionResult() });
  return (
    <Form form={form} definition={signupForm}>
      <TextField name="name" label="Name" />
      <TextField name="email" label="Email" type="email" />
      <Button type="submit">Create account</Button>
    </Form>
  );
}
```

## What the fields get

- **Issues.** Each named field shows its own issues: `aria-invalid`, `aria-describedby` and its `FieldError`. The TextField shorthand (`label`, no children) always includes a `FieldError`.
- **Timing.** The definition's `validateOn` and `revalidateOn` apply, for example issues on blur that clear while you type.
- **Submit.** A submit validates every field and focuses the first invalid one. A valid submit posts with fetch, and the action's redirect is routed in the page. A `type="submit"` Button is pending (`isPending`) while it runs.
- **Values.** A TextField without `value` or `defaultValue` starts from the store's `initial` value. After a failed post without JavaScript, it starts from the value that was sent; passwords are never echoed.
- **Messages.** Pass `format={(issue) => t(issue.key)}` to translate issue keys.

## Without JavaScript

The form is a native `<form method="post" action="?/signup">`. Without JavaScript it posts to the action. A failed post returns a 400 page that shows the same issues and the values that were sent, so the form works before any script loads.

## More

- The [forms guide](site:docs/guides/forms/forms/) covers the full engine: server pipeline, field checks, arrays, wizards, autosave and CSRF.
- The [Form](/components/form/) reference lists the `form`, `definition` and `format` props.
