import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { LivePageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onSubmit, submitting } from "@rivetjs/forms";
import { FieldError } from "@rivetjs/forms/components";
import { action, invalid } from "@rivetjs/forms/server";
import { contactForm } from "../forms/contact.ts";

const contacts = [{ id: 1, name: "Ada Lovelace", email: "ada@example.com" }];

export const head = { title: "Contacts" };

// Live page: after a successful submit `data` is refreshed in place; signals (drawer, likes) survive.
export const live = true;

export const serverLoad = ({ url }: { url: URL }) => ({ contacts: [...contacts], creating: url.searchParams.has("new") });

export const serverActions = {
  contact: action(contactForm, (value) => {
    if (contacts.some((c) => c.email === value.email)) return invalid({ email: "Already a contact" });
    contacts.push({ id: contacts.length + 1, ...value });
  }),
};

export default function Contacts({ data }: LivePageProps<typeof serverLoad>) {
  const result = actionResult("contact");
  const open = signal(data().creating || (result?.status ?? 0) >= 400);
  const likes = signal(0);
  const form = createForm(contactForm, { result });
  return (
    <main class="mx-auto max-w-lg p-6">
      <div class="flex items-center gap-2">
        <h1 class="mr-auto text-xl font-semibold">Contacts</h1>
        <button id="likes" type="button" class="rounded border px-3 py-1" onClick={() => likes.update((n) => n + 1)}>
          Liked {likes()}
        </button>
        <a
          id="add"
          href="?new"
          data-rivet-prefetch="none"
          class="rounded bg-teal-700 px-3 py-1 text-white"
          onClick={(event) => {
            event.preventDefault();
            open.set(true);
          }}
        >
          Add contact
        </a>
      </div>
      <ul id="contacts" class="mt-4 grid gap-1">
        <For each={data().contacts} by={(contact) => contact.id}>
          {(contact) => (
            <li class="rounded border px-3 py-2">
              {contact().name} <span class="text-slate-500">{contact().email}</span>
            </li>
          )}
        </For>
      </ul>
      <ModalOverlay isDismissable isOpen={open} class="fixed inset-0 bg-slate-900/40">
        <Modal class="fixed inset-y-0 right-0 w-80 bg-white p-6 shadow-xl">
          <Dialog class="grid gap-2 outline-none">
            <Heading slot="title" class="text-lg font-semibold">
              New contact
            </Heading>
            <form
              id={formId(form)}
              method="post"
              action="?/contact"
              class="grid gap-2"
              onSubmit={async (event) => (await onSubmit(contactForm, form, event)) && open.set(false)}
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
              <button id="save" class="justify-self-start rounded bg-teal-700 px-4 py-1 text-white" aria-disabled={submitting(form) ? "true" : undefined}>
                Save
              </button>
            </form>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
}
