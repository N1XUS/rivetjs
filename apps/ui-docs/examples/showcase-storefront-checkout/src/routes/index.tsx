// Rivet-authored showcase (own content: a fictional shop). The storefront's checkout on the live forms API.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { LivePageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm, defaultValue, describedBy, fieldId, formId, isInvalid, onSubmit, submitting } from "@rivetjs/forms";
import { FieldError } from "@rivetjs/forms/components";
import { action, invalid } from "@rivetjs/forms/server";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";
import { Separator } from "@rivetjs/ui/separator";
import { CircleCheck, ShoppingBag } from "lucide";
import { checkoutForm } from "../forms/checkout.ts";
import { shop, UNSERVED } from "../bag.server.ts";
import { load, actions } from "@rivetjs/router";

export const head = { title: "Showcase: Checkout on the server" };

// #region demo
// A live page: `data` is an accessor. After a successful submit the router puts fresh loader data
// into it in place: the drawer, focus and any client state survive; the bag list just updates.
export const live = true;

// `?checkout` opens the drawer on the server: the entry point without JavaScript.
export const loader = load(({ url }: { url: URL }) => ({
  lines: shop.lines.map((line) => ({ ...line })),
  lastOrder: shop.lastOrder,
  checkingOut: url.searchParams.has("checkout"),
}));

export const forms = actions({
  checkout: action(checkoutForm, (value) => {
    if (UNSERVED.includes(value.postcode)) return invalid({ postcode: "We do not deliver there yet" });
    if (shop.lines.length === 0) return invalid({ email: "Your bag is empty" });
    shop.lastOrder = `FN-${shop.nextOrder++}`;
    shop.lines = [];
  }),
});

// One module-level formatter: `toLocaleString(locale)` builds a new Intl.NumberFormat on every call.
const amount = new Intl.NumberFormat("en-US");
const money = (n: number) => `$${amount.format(n)}`;
const field =
  "w-full rounded-xl border border-border bg-field px-3 py-2 text-sm text-field-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

export default function Checkout({ data }: LivePageProps<typeof loader>) {
  // Without JavaScript, a failed POST renders the page again with the drawer open and the problems in it.
  const result = actionResult("checkout");
  const open = signal(data().checkingOut || (result?.status ?? 0) >= 400);
  const form = createForm(checkoutForm, { result });
  const total = () => data().lines.reduce((n, line) => n + line.qty * line.price, 0);

  return (
    <main class="mx-auto flex max-w-lg flex-col gap-4 p-4">
      <header class="flex items-center gap-2">
        <Icon icon={ShoppingBag} size={18} />
        <h1 class="me-auto text-lg font-semibold">Your bag</h1>
        {/* A link without JavaScript; with it, the click opens the drawer in place. Its id must not be the form's id (= the form name). */}
        <a
          id="open-checkout"
          href="?checkout"
          data-rivet-prefetch="none"
          class="button button--primary button--sm"
          onClick={(event) => {
            event.preventDefault();
            open.set(true);
          }}
        >
          Check out
        </a>
      </header>
      {data().lastOrder ? (
        <p id="last-order" class="flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-sm text-success-soft-foreground">
          <Icon icon={CircleCheck} size={16} />
          Order {data().lastOrder} is on its way.
        </p>
      ) : null}
      <ul id="bag-lines" class="m-0 flex list-none flex-col gap-2 p-0">
        <For each={data().lines} by={(line) => line.id}>
          {(line) => (
            <li class="flex justify-between rounded-2xl bg-surface p-3 text-sm">
              <span>
                {line().qty} × {line().name}
              </span>
              <span class="tabular-nums">{money(line().qty * line().price)}</span>
            </li>
          )}
        </For>
      </ul>
      <p class="text-sm text-muted">{data().lines.length === 0 ? "Your bag is empty." : `Total ${money(total())}`}</p>

      {/* isOpen is two-way: Escape, the close button or a press outside write false. */}
      <Drawer.Content isOpen={open} placement="right">
        <Drawer.Header>
          <Drawer.Heading>Checkout</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <form
            id={formId(form)}
            method="post"
            action="?/checkout"
            class="flex flex-col gap-3"
            // Resolves true once the server accepted the order and the page data is fresh.
            onSubmit={async (event) => (await onSubmit(checkoutForm, form, event)) && open.set(false)}
          >
            {(
              [
                ["email", "Email", "email"],
                ["name", "Full name", "text"],
                ["address", "Street address", "text"],
                ["postcode", "Postcode", "text"],
              ] as const
            ).map(([name, label, type]) => (
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium" for={fieldId(form, name)}>
                  {label}
                </label>
                <input
                  id={fieldId(form, name)}
                  name={name}
                  type={type}
                  class={field}
                  value={defaultValue(form, name)}
                  aria-invalid={isInvalid(form, name)}
                  aria-describedby={describedBy(form, name)}
                />
                <FieldError of={form} name={name} class="text-xs text-danger" />
              </div>
            ))}
            <Separator />
            <div class="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span class="tabular-nums">{money(total())}</span>
            </div>
            <Button id="pay" type="submit" fullWidth isPending={submitting(form)}>
              Pay {money(total())}
            </Button>
          </form>
        </Drawer.Body>
      </Drawer.Content>
    </main>
  );
}
// #endregion
