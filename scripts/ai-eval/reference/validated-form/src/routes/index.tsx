import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { actionResult } from "@rivetjs/router/client";
import { createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onBlur, onInput, onSubmit } from "@rivetjs/forms";
import { FieldError } from "@rivetjs/forms/components";
import { action, invalid } from "@rivetjs/forms/server";
import { signupForm } from "../forms/signup.ts";

const subscribers = new Set<string>(["taken@example.com"]);

export const serverActions = {
  signup: action(signupForm, (value) => {
    if (subscribers.has(value.email)) return invalid({ email: "Already subscribed" });
    subscribers.add(value.email);
  }),
};

export const head = { title: "Newsletter" };

// Live page: a successful submit refreshes the page data in place, so `done` survives it.
export const live = true;

export default function Signup() {
  const result = actionResult("signup");
  const form = createForm(signupForm, { result });
  const done = signal(result?.status === 200);
  return (
    <main class="mx-auto max-w-md p-6">
      <h1 class="text-2xl font-bold">Newsletter</h1>
      <form
        id={formId(form)}
        method="post"
        action="?/signup"
        class="mt-4 grid gap-2"
        onInput={(event) => onInput(signupForm, form, event)}
        onFocusOut={(event) => onBlur(signupForm, form, event)}
        onSubmit={async (event) => {
          if (await onSubmit(signupForm, form, event)) done.set(true);
        }}
      >
        <label for={fieldId(form, "name")}>Name</label>
        <input
          id={fieldId(form, "name")}
          name="name"
          class="rounded border px-2 py-1"
          value={defaultValue(form, "name")}
          aria-invalid={isInvalid(form, "name")}
          aria-describedby={describedBy(form, "name")}
        />
        <FieldError of={form} name="name" class="text-sm text-red-700" />
        <label for={fieldId(form, "email")}>Email</label>
        <input
          id={fieldId(form, "email")}
          name="email"
          class="rounded border px-2 py-1"
          value={defaultValue(form, "email")}
          aria-invalid={isInvalid(form, "email")}
          aria-describedby={describedBy(form, "email")}
        />
        <FieldError of={form} name="email" class="text-sm text-red-700" />
        <button id="subscribe" class="justify-self-start rounded bg-teal-700 px-4 py-1 text-white">
          Subscribe
        </button>
      </form>
      <Show when={done()}>
        <p id="thanks" class="mt-4">
          Thanks for subscribing
        </p>
      </Show>
    </main>
  );
}
