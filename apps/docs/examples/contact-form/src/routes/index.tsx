import { redirect } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { action } from "@rivetjs/forms/server";
import { autofocus, createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onBlur, onInput, onSubmit } from "@rivetjs/forms";
import { ErrorSummary, FieldError } from "@rivetjs/forms/components";
import { contactForm } from "../forms/contact.ts";

export const head = { title: "Contact" };

// #region demo
// Server code in the page file: removed from the browser build, with `action` and its import.
export const serverActions = {
  // `action` reads the body, checks it against the schema, and only then calls your function.
  // Invalid input answers 400 with the problems; the page shows them next to the fields.
  contact: action(contactForm, (value) => {
    console.log("New message from", value.email);
    return redirect("/thanks");
  }),
};

export default function Contact() {
  // After a POST without JavaScript, actionResult() holds the server's answer (problems, typed values).
  const form = createForm(contactForm, { result: actionResult() });
  return (
    <main class="mx-auto max-w-md p-4">
      <h1 class="text-xl font-semibold">Contact us</h1>
      <form
        id={formId(form)}
        method="post"
        action="?/contact"
        class="mt-4 grid gap-2"
        onInput={(event) => onInput(contactForm, form, event)}
        onFocusOut={(event) => onBlur(contactForm, form, event)}
        onSubmit={(event) => onSubmit(contactForm, form, event)}
      >
        <ErrorSummary of={form} class="text-red-700" />
        <label for={fieldId(form, "email")}>Email</label>
        <input
          id={fieldId(form, "email")}
          name="email"
          type="email"
          autoComplete="email"
          class="rounded border px-2 py-1"
          value={defaultValue(form, "email")}
          autoFocus={autofocus(form, "email")}
          aria-invalid={isInvalid(form, "email")}
          aria-describedby={describedBy(form, "email")}
        />
        <FieldError of={form} name="email" class="text-sm text-red-700" />
        <label for={fieldId(form, "message")}>Message</label>
        <textarea
          id={fieldId(form, "message")}
          name="message"
          class="rounded border px-2 py-1"
          autoFocus={autofocus(form, "message")}
          aria-invalid={isInvalid(form, "message")}
          aria-describedby={describedBy(form, "message")}
        >
          {defaultValue(form, "message")}
        </textarea>
        <FieldError of={form} name="message" class="text-sm text-red-700" />
        <button class="justify-self-start rounded bg-teal-700 px-4 py-1 text-white">Send</button>
      </form>
    </main>
  );
}
// #endregion
