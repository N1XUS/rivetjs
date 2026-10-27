// Rivet-authored showcase (own content: a fictional shop). The storefront's checkout on the live forms API.
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { LivePageProps } from "@rivetjs/router";
import { actionResult } from "@rivetjs/router/client";
import { createForm } from "@rivetjs/forms";
import { action, invalid } from "@rivetjs/forms/server";
import { Alert } from "@rivetjs/ui/alert";
import { Button } from "@rivetjs/ui/button";
import { DescriptionList } from "@rivetjs/ui/description-list";
import { Drawer } from "@rivetjs/ui/drawer";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Form } from "@rivetjs/ui/form";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Separator } from "@rivetjs/ui/separator";
import { TextField } from "@rivetjs/ui/textfield";
import { ShoppingBag } from "lucide";
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
        {/* A link without JavaScript (`render` = an `a` with the Button's classes and press handling); with it, the click
            opens the drawer in place. Its id must not be the form's id (= the form name). */}
        <Button
          id="open-checkout"
          size="sm"
          render={(props) => <a {...(props as object)} type={undefined} href="?checkout" data-rivet-prefetch="none" />}
          onClick={(event: MouseEvent) => {
            event.preventDefault();
            open.set(true);
          }}
        >
          Check out
        </Button>
      </header>
      {data().lastOrder ? (
        <Alert id="last-order" status="success">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Order {data().lastOrder} is on its way.</Alert.Title>
          </Alert.Content>
        </Alert>
      ) : null}
      {data().lines.length === 0 ? (
        <EmptyState id="bag-empty" variant="outline">
          Your bag is empty.
        </EmptyState>
      ) : (
        <ItemCardGroup id="bag-lines" aria-label="Bag">
          <For each={data().lines} by={(line) => line.id}>
            {(line) => (
              <ItemCard>
                <ItemCard.Content>
                  <ItemCard.Title>
                    {line().qty} × {line().name}
                  </ItemCard.Title>
                </ItemCard.Content>
                <ItemCard.Action class="text-sm tabular-nums">{money(line().qty * line().price)}</ItemCard.Action>
              </ItemCard>
            )}
          </For>
        </ItemCardGroup>
      )}
      <DescriptionList aria-label="Bag total">
        <DescriptionList.Item isEmphasized>
          <DescriptionList.Term>Total</DescriptionList.Term>
          <DescriptionList.Details id="bag-total">{money(total())}</DescriptionList.Details>
        </DescriptionList.Item>
      </DescriptionList>

      {/* isOpen is two-way: Escape, the close button or a press outside write false. */}
      <Drawer.Content isOpen={open} placement="right">
        <Drawer.Header>
          <Drawer.Heading>Checkout</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          {/* ui Form joined to the forms store: id / method / action from the definition, issues reach the named fields.
              `result` resolves true once the server accepted the order and the page data is fresh. */}
          <Form form={form} definition={checkoutForm} class="flex flex-col gap-3" onSubmit={async (_event, result) => (await result) && open.set(false)}>
            <TextField id="checkout-email" name="email" type="email" label="Email" autoComplete="email" variant="secondary" fullWidth />
            <TextField id="checkout-name" name="name" label="Full name" autoComplete="name" variant="secondary" fullWidth />
            <TextField id="checkout-address" name="address" label="Street address" autoComplete="street-address" variant="secondary" fullWidth />
            <TextField id="checkout-postcode" name="postcode" label="Postcode" autoComplete="postal-code" variant="secondary" fullWidth />
            <Separator />
            <DescriptionList aria-label="Order total">
              <DescriptionList.Item isEmphasized>
                <DescriptionList.Term>Total</DescriptionList.Term>
                <DescriptionList.Details>{money(total())}</DescriptionList.Details>
              </DescriptionList.Item>
            </DescriptionList>
            <Button id="pay" type="submit" fullWidth>
              Pay {money(total())}
            </Button>
          </Form>
        </Drawer.Body>
      </Drawer.Content>
    </main>
  );
}
// #endregion
