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
import { customerForm } from "../forms/customer.ts";
import { customers } from "../customers.server.ts";
import { load, actions } from "@rivetjs/router";

export const head = { title: "Customers" };

// #region demo
// A live page: `data` is an accessor. After a successful submit the router puts the fresh loader
// data into it (and into the layout) — the page is not re-rendered, so the drawer, the counter and
// focus keep their state.
export const live = true;

// `?new` opens the drawer on the server: the entry point without JavaScript.
export const loader = load(({ url }: { url: URL }) => ({ customers: [...customers], creating: url.searchParams.has("new") }));

export const forms = actions({
  customer: action(customerForm, (value) => {
    if (customers.some((c) => c.email === value.email)) return invalid({ email: "That email is already a customer" });
    customers.push({ id: customers.length + 1, ...value });
  }),
});

export default function Customers({ data }: LivePageProps<typeof loader>) {
  // Without JavaScript, a failed POST renders the page again with the drawer open and the problems in it.
  const result = actionResult("customer");
  const open = signal(data().creating || (result?.status ?? 0) >= 400);
  const clicks = signal(0);
  const form = createForm(customerForm, { result });
  return (
    <main>
      <div class="flex items-center gap-2">
        <h1 class="mr-auto text-xl font-semibold">Customers</h1>
        <button id="clicks" type="button" class="rounded border px-3 py-1" onClick={() => clicks.update((n) => n + 1)}>
          Clicked {clicks()}
        </button>
        {/* A link without JavaScript; with it, the click opens the drawer in place. */}
        <a
          id="new"
          href="?new"
          data-rivet-prefetch="none"
          class="rounded bg-teal-700 px-3 py-1 text-white"
          onClick={(event) => {
            event.preventDefault();
            open.set(true);
          }}
        >
          New customer
        </a>
      </div>
      <ul id="customers" class="mt-4 grid gap-1">
        <For each={data().customers} by={(customer) => customer.id}>
          {(customer) => (
            <li class="rounded border px-3 py-2">
              {customer().name} <span class="text-slate-500">{customer().email}</span>
            </li>
          )}
        </For>
      </ul>
      {/* isOpen is two-way: Escape or a press outside writes false. */}
      <ModalOverlay isDismissable isOpen={open} class="fixed inset-0 bg-slate-900/40">
        <Modal class="fixed inset-y-0 right-0 w-80 bg-white p-6 shadow-xl">
        <Dialog class="grid gap-2 outline-none">
          <Heading slot="title" class="text-lg font-semibold">
            New customer
          </Heading>
          <form
            id={formId(form)}
            method="post"
            action="?/customer"
            class="grid gap-2"
            // Resolves true once the server accepted the form and the page data is fresh.
            onSubmit={async (event) => (await onSubmit(customerForm, form, event)) && open.set(false)}
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
// #endregion
