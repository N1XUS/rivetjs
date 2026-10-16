import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { LivePageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";
import { createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onSubmit } from "@rivetjs/forms";
import { FieldError } from "@rivetjs/forms/components";
import { action, invalid } from "@rivetjs/forms/server";
import { customerForm } from "../forms.js";
import { add, list, taken } from "../customers.server.js";

export const head = { title: "Customers" };
// Live page: `data` is an accessor; a successful enhanced submit updates it (and the layout) in place,
// so the drawer, the click counter and focus survive.
export const live = true;

// `?new` opens the drawer on the server (no-JS entry point); the action re-renders the page.
export const serverLoad = ({ url }: { url: URL }) => ({ customers: list(), creating: url.searchParams.has("new") });
export const serverActions = {
  customer: action(customerForm, (value) => {
    if (taken(value.email)) return invalid({ email: "That email is already a customer" });
    add(value.name, value.email);
  }),
};

/** Customer list + "New customer" drawer (cdk Modal) with an enhanced form. */
export default function Customers({ data }: LivePageProps<typeof serverLoad>) {
  const result = actionResult("customer");
  // No JS: the drawer renders open for `?new` and after a failed POST (its issues show inside).
  const open = signal(data().creating || (result?.status ?? 0) >= 400);
  const clicks = signal(0);
  const form = createForm(customerForm, { result });
  return (
    <section>
      <h1>Customers</h1>
      <button id="clicks" type="button" onClick={() => clicks.update((n) => n + 1)}>
        Clicked {clicks()}
      </button>{" "}
      {/* No JS: `?new` renders the drawer open. With JS the click opens it in place (no prefetch of `?new`). */}
      <a
        id="new"
        href="?new"
        data-rivet-prefetch="none"
        onClick={(event) => {
          event.preventDefault();
          open.set(true);
        }}
      >
        New customer
      </a>
      {/* A search-only navigation with JS: the live page stays (refreshed in place, `data().creating` follows the URL). */}
      <a id="new-url" href="?new" data-rivet-prefetch="none">
        New customer (URL)
      </a>
      <p id="creating">{data().creating ? "creating" : "listing"}</p>
      <ul id="customers">
        <For each={data().customers} by={(customer) => customer.id}>
          {(customer) => (
            <li>
              {customer().name} &lt;{customer().email}&gt;
            </li>
          )}
        </For>
      </ul>
      <Modal isDismissable isOpen={open}>
        <Dialog id="drawer" class="drawer">
          <Heading slot="title">New customer</Heading>
          <form
            id={formId(form)}
            method="post"
            action="?/customer"
            class="stack"
            onSubmit={async (event) => (await onSubmit(customerForm, form, event)) && open.set(false)}
          >
            <label for={fieldId(form, "name")}>Name</label>
            <input
              id={fieldId(form, "name")}
              name="name"
              class="input"
              value={defaultValue(form, "name")}
              aria-invalid={isInvalid(form, "name")}
              aria-describedby={describedBy(form, "name")}
            />
            <FieldError of={form} name="name" class="error" />
            <label for={fieldId(form, "email")}>Email</label>
            <input
              id={fieldId(form, "email")}
              name="email"
              class="input"
              value={defaultValue(form, "email")}
              aria-invalid={isInvalid(form, "email")}
              aria-describedby={describedBy(form, "email")}
            />
            <FieldError of={form} name="email" class="error" />
            <button id="save" type="submit" class="button">
              Save
            </button>
          </form>
        </Dialog>
      </Modal>
    </section>
  );
}
