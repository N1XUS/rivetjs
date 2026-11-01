---
title: Forms
description: Build forms with @rivetjs/forms that are checked by a schema in the browser and on the server, show accessible errors, and work without JavaScript.
template: guide
status: experimental
related: [guides/routing/actions-and-forms, guides/components/forms-and-input, best-practices/links-and-forms-without-js]
---

`@rivetjs/forms` builds on [actions](../routing/actions-and-forms.md). You describe the form once, with a schema. The same description checks the input in the browser, while the user types, and again on the server, where it counts. Errors appear next to the right fields, with the right ARIA attributes. And the form keeps working when JavaScript has not loaded or is turned off. After reading this page you can build such a form and know what happens with and without JavaScript.

::example{id=contact-form}

:::note
This package is available on npm as `0.1.0-alpha.1`. Install it with `npm install @rivetjs/forms`. Its APIs are experimental.
:::

## Describe the form

Create a definition at module level, in a normal module the page imports:

```ts title="src/forms/contact.ts"
import { defineForm } from "@rivetjs/forms";
import { z } from "zod";

export const contactForm = defineForm({
  name: "contact", // the action name: <form action="?/contact">
  schema: z.object({
    email: z.string().email("Enter an email address like name@example.com"),
    message: z.string().min(10, "Write at least 10 characters"),
  }),
  validateOn: "blur",
});
```

The schema can come from any library that supports [Standard Schema](https://standardschema.dev): Zod, Valibot, ArkType, or your own object. Form fields arrive as text; use `coerce` to turn them into other types, for example `coerce: { age: "number" }`. A `"number"` field takes decimal notation only (`42`, `-1.5`, `1e3`); text such as `0x1F` or `Infinity` stays a string, so the schema reports a type issue.

`validateOn` says when a field is first checked: `"submit"` (default), `"blur"` (when the user leaves the field), `"input"` or `"change"`. Once a field shows a problem, it is checked again on every input, so the message goes away as soon as the value is fixed.

Problems normally show once a field was touched or the form was submitted. `showIssues: "always"` shows them as soon as they exist. After a failed submit the first invalid field gets focus; `focusOnInvalid: false` turns that off.

Field names starting with `_` that Rivet uses itself (`_form`, `_intent`, `_csrf`, `_draft`, `_step`, `_version`) never reach the schema: don't give your own fields these names.

## Handle it on the server

Wrap your action with `action()` from `@rivetjs/forms/server`, and export it from the page file as `actions(…)`:

```tsx title="src/routes/contact.tsx"
import { redirect, actions } from "@rivetjs/router";
import { action } from "@rivetjs/forms/server";
import { contactForm } from "../forms/contact.ts";
import { saveMessage } from "../messages.server.ts";

export const forms = actions({
  contact: action(contactForm, async (value) => {
    await saveMessage(value.email, value.message); // value is typed and valid
    return redirect("/thanks");
  }),
});
```

The compiler removes `actions(…)` from the browser build, and `@rivetjs/forms/server` and `saveMessage` with it. Your function only runs when the input passes the schema. Before that, `action()`:

1. rejects posts from other sites, also when the browser sends neither `Origin` nor `Sec-Fetch-Site` (in production);
2. refuses wrong content types (`415`) and too-large bodies (`413`; 1 MiB for normal forms, 10 MiB for file uploads);
3. checks the values with the schema. On failure it answers `400` with the problems and the values the user typed (except files and fields that look secret: names with `password`, `secret`, `token`, `otp`, `pin`, `cvv`, `ssn`, `iban`, `apiKey`, a card number; add more paths with `echo: { exclude: ["card.holder"] }` in `defineForm`).

Your function can also reject the input itself, for example when an email is already taken: return `invalid({ email: "This email is already registered" })`. `invalid` comes from the same module as `action`:

```tsx
import { action, invalid } from "@rivetjs/forms/server";
```

## Render the form

The component goes in the same file:

```tsx title="src/routes/contact.tsx"
import { actionResult } from "@rivetjs/router/client";
import { autofocus, createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onBlur, onInput, onSubmit } from "@rivetjs/forms";
import { ErrorSummary, FieldError } from "@rivetjs/forms/components";
import { contactForm } from "../forms/contact.ts";

export default function Contact() {
  const form = createForm(contactForm, { result: actionResult() });
  return (
    <form
      id={formId(form)}
      method="post"
      action="?/contact"
      onInput={(event) => onInput(contactForm, form, event)}
      onFocusOut={(event) => onBlur(contactForm, form, event)}
      onSubmit={(event) => onSubmit(contactForm, form, event)}
    >
      <ErrorSummary of={form} />
      <label for={fieldId(form, "email")}>Email</label>
      <input
        id={fieldId(form, "email")}
        name="email"
        type="email"
        value={defaultValue(form, "email")}
        autoFocus={autofocus(form, "email")}
        aria-invalid={isInvalid(form, "email")}
        aria-describedby={describedBy(form, "email")}
      />
      <FieldError of={form} name="email" />
      {/* … the message field the same way … */}
      <button>Send</button>
    </form>
  );
}
```

- `createForm` makes the form's state: which fields were touched, which have problems, whether it is sending. The browser recreates the form store when its boundary adopts, using the action result and input state. The values themselves stay in the inputs.
- `result: actionResult()` hands over the server's answer after a failed post.
- The helpers give each input its `id`, its typed `name`, its old value, `aria-invalid`, and `aria-describedby` that points to its error text.
- `FieldError` shows a field's message. `ErrorSummary` lists all problems in a `role="alert"` box, with links to the fields.
- The three handlers sit on the `<form>`, not on each input. They are rebuilt when the form's boundary adopts; module placement and shared imports determine the chunks.
- If your inputs keep native checks (`required`, `type="email"`) for visitors without JavaScript, also add `onInvalidCapture={(event) => onInvalid(contactForm, form, event)}` (import `onInvalid` from `@rivetjs/forms`). The browser's own check stops the very first submit before `onSubmit` runs; with this handler the library shows its messages for that attempt too, instead of the browser's bubbles.

`name` values are typed: `fieldId(form, "emial")` is a TypeScript error.

## Without JavaScript

If the script has not loaded yet, or never loads, the browser sends the form as a normal `POST` to `?/contact`:

- valid input: your function runs and the browser follows the redirect;
- invalid input: the server renders the page again with status `400`. The fields keep what the user typed, the messages show next to them, and the first wrong field gets `autofocus`.

No step needs JavaScript.

## With JavaScript

Once the user interacts with the form, its handlers take over:

- problems show while the user fills in the form, following `validateOn`;
- on submit, the form is checked in the browser first. If something is wrong, nothing is sent and focus moves to the first wrong field;
- if all is fine, the form is sent in the background (with `fetch`). A redirect from the action becomes a client navigation; problems found by the server appear at their fields. If the page's router has not started within 10 seconds of the answer (a very slow connection), the browser loads the redirect target as a normal page instead, so unsent client state, such as other fields, is lost.
- after a redirect to another page, every loader of that page runs again, its layouts' too, so a header that reads the session cookie shows the new sign-in state.
- when the action stays on the page, the same answer carries the page's fresh data, and the page shows it. On a [live page](./forms-in-overlays.md) only the parts that read the data change; the rest of the page, an open drawer included, keeps its state.
- `onSubmit` resolves to `true` once the server accepted the form and the page is up to date, else `false`. Use it to close the dialog the form is in.

The server checks everything again either way. Browser checks are for the user's comfort, never for security.

## Send to another service

To post to a third-party form service (or run your own client code) instead of a server action, give the definition a `submit` function. It runs in the browser after the browser checks pass, with the checked values:

```ts
import { defineForm } from "@rivetjs/forms";

export const contactForm = defineForm({
  name: "contact",
  schema: contactSchema,
  submit: async (value, { formData, signal }) => {
    const response = await fetch("https://formcarry.com/s/XXXX", { method: "POST", body: formData, headers: { accept: "application/json" }, signal });
    if (response.status === 422) return { ok: false, issues: { email: "That address bounced" } };
    if (!response.ok) throw new Error("Could not send your message");
    return { ok: true, data: { sent: true } };
  },
});
```

- While it runs, `submitting(form)` is `true`. Submitting again cancels the previous call (`signal`).
- Return `{ ok: false, issues, form }` to show problems at their fields; focus moves to the first one.
- Anything else counts as success: the form resets and `lastResult(form)` holds `data`.
- A thrown error shows as a form-level problem with the error's message (`<FormStatus>`, `<ErrorSummary>`).
- Without JavaScript the form posts normally, so point its `action` at the same URL: `<form method="post" action="https://formcarry.com/s/XXXX">`.

`focusFirstInvalid(form)` moves focus to the first field with a problem, for flows that call `validate()` themselves.

## Read the form state

These functions read the state, for example to disable the button while sending:

```tsx
import { submitting } from "@rivetjs/forms";

<button disabled={submitting(form)}>{submitting(form) ? "Sending…" : "Send"}</button>;
```

Others: `touched`, `dirty`, `issues`, `issueText`, `validating` (an async check is running), `submitted`, `submitCount` and `lastResult` (what a successful background submit returned). `setValue`, `setIssues`, `clearIssues`, `reset`, `validate` and `focusFirstInvalid` change it from code.

## More building blocks

Each lives in its own entry, so you only pay for what you import. Server helpers such as `wizardAction(...)` return the whole actions object (`export const forms = actions(wizardAction(...))`); call `loadWizard(...)` inside `load(…)`. Draft ids travel in URLs (`?draft=`), so they can leak through history, logs or a shared link: your `DraftStore` must bind each draft to its owner. `load`, `save` and `delete` get the request event; store the signed-in user (or session) with a new draft and return nothing for anyone else's. Wizard steps never adopt a draft id the store does not know: they start a new draft with a random id. Fields that look secret (`password`, `token`, `pin`, `cvv`, card numbers, …) are never echoed, autosaved or stored as drafts. A second submit of a wizard's last step while its `onComplete` is still running (a double click, a retry) gets a 409 conflict instead of completing again; with several server processes, make `onComplete` idempotent per draft id.

| Entry | For |
| --- | --- |
| `@rivetjs/forms/array` | Lists of fields (order lines) with add, remove and move buttons that also work without JavaScript. |
| `@rivetjs/forms/scope` | Reusing one part of a form, such as an address block, under a prefix (`billing.city`). |
| `@rivetjs/forms/wizard` | Forms in several steps, each with its own schema. |
| `@rivetjs/forms/autosave` | Saving drafts while the user types. |
| `@rivetjs/forms/errors` | Mapping your backend's error format onto fields. |
| `@rivetjs/forms/csrf` | Token-based CSRF protection, for setups where proxies strip the `Origin` header. |

A field can also have its own async check, for example "is this user name free?", with `fields: { name: { validate: async (value) => …, server: true } }` in `defineForm`.

## Common mistakes

- **Different `name` and action key.** `defineForm({ name: "contact" })` needs a `contact` action in `actions({ … })` and `action="?/contact"`.
- **Leaving out `result: actionResult()`.** Without it, the page after a failed post without JavaScript shows no messages.
- **Putting the form definition in a `.server.ts` file.** The browser needs it for its checks. Keep it in a normal module, and keep secrets out of it.
- **Reading `?next=` or `?token=` from the page URL only.** `action="?/login"` replaces the page's query, and after a failed submit the page is rendered without one. Put such values in the form as a hidden input (it is echoed back with the other fields) and read them from there.
- **Rendering one definition twice on a page.** Pass a different `id` to each `createForm` call and add `<FormMeta of={form} />` inside each form.

## See also

- [Actions and forms](../routing/actions-and-forms.md): what the router does with a post
- [Forms and input](/guides/components/forms-and-input.md): inputs and events without the library
- [Design spec](https://github.com/N1XUS/rivetjs/blob/main/docs/design/specs/2026-10-03-forms-design.md)
