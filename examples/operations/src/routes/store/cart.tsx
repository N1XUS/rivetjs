import { load, guard, deny, actions, redirect, headers, type RequestEvent, type PageProps } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { cartFor, sessionUser, checkout } from "../../server/service.server.ts";
import { userOf } from "../../server/http.server.ts";
import { SiteNav } from "../../sites/SiteNav.tsx";
import { request, money } from "../../sites/client.ts";
export const access = guard((e: RequestEvent) => {
  if (!sessionUser(e.cookies.get("case-session"))) throw deny(401, "Sign in to use your bag");
});
export const loader = load((e: RequestEvent) => ({ cart: cartFor(userOf(e)) }));
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store", vary: "Cookie" }));
export const forms = actions({
  place: async (e: RequestEvent) => {
    const f = await e.request.formData();
    const order = checkout(userOf(e), { version: Number(f.get("version")), key: String(f.get("key")) });
    return redirect("/store/orders/" + order.id, 303);
  },
});
export default function Cart({ data }: PageProps<typeof loader>) {
  const cart = signal(data.cart),
    error = signal(""),
    coupon = signal(data.cart.coupon),
    busy = signal(false),
    orderKey = signal("cart-" + Date.now());
  async function change(sku: string, quantity: number) {
    busy.set(true);
    error.set("");
    try {
      cart.set(await request<typeof data.cart>("/store/api/cart", "PUT", { version: cart().version, sku, quantity, coupon: coupon() }));
    } catch (e) {
      error.set(String(e));
    } finally {
      busy.set(false);
    }
  }
  async function place(event: Event) {
    event.preventDefault();
    if (busy()) return;
    busy.set(true);
    error.set("");
    try {
      const order = await request<{ id: string }>("/store/api/checkout", "POST", { version: cart().version, key: orderKey() });
      location.assign("/store/orders/" + order.id);
    } catch (e) {
      error.set(String(e));
      busy.set(false);
    }
  }
  return (
    <>
      <SiteNav />
      <main>
        <p class="eyebrow">YOUR SELECTION</p>
        <h1>A few good things.</h1>
        <p>Saved to your account. Prices and availability are checked again when you place an order.</p>
        <p id="cart-error" role="alert">
          {error()}
        </p>
        <button
          id="cart-reload"
          onClick={async () => {
            cart.set(await request<typeof data.cart>("/store/api/cart"));
            error.set("");
          }}
        >
          Reload saved bag
        </button>
        <div class="checkout-grid">
          <section>
            <Show when={cart().items.length === 0}>
              <p id="empty-cart">Your bag is empty.</p>
            </Show>
            <For each={cart().items} by={(i) => i.product.sku}>
              {(i) => (
                <div class="cart-line" data-cart-sku={i().product.sku}>
                  <div class="mini-product">{i().product.category}</div>
                  <div>
                    <h2>{i().product.name}</h2>
                    <p>{money(i().product.price)} each</p>
                    <button class="decrease" disabled={busy()} onClick={() => void change(i().product.sku, i().quantity - 1)}>
                      Less
                    </button>
                    <output class="quantity">{i().quantity}</output>
                    <button class="increase" disabled={busy()} onClick={() => void change(i().product.sku, i().quantity + 1)}>
                      More
                    </button>
                    <button class="remove-item" disabled={busy()} onClick={() => void change(i().product.sku, 0)}>
                      Remove
                    </button>
                  </div>
                  <strong>{money(i().product.price * i().quantity)}</strong>
                </div>
              )}
            </For>
            <label>
              Promotion code
              <input id="coupon" model:value={coupon} />
            </label>
            <button
              id="apply-coupon"
              disabled={busy() || !cart().items.length}
              onClick={() => {
                const first = cart().items[0];
                if (first) void change(first.product.sku, first.quantity);
              }}
            >
              Apply promotion
            </button>
          </section>
          <section class="order-summary">
            <h2>Order summary</h2>
            <dl>
              <dt>Subtotal</dt>
              <dd id="subtotal">{money(cart().subtotal)}</dd>
              <dt>Promotion</dt>
              <dd id="discount">{money(cart().discount)}</dd>
              <dt>Shipping</dt>
              <dd>{money(cart().shipping)}</dd>
              <dt>Total</dt>
              <dd id="cart-total">{money(cart().total)}</dd>
            </dl>
            <form method="post" action="?/place" onSubmit={(e) => void place(e)}>
              <input type="hidden" name="version" value={String(cart().version)} />
              <input type="hidden" name="key" value={orderKey()} />
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Delivery address
                <textarea name="address" required />
              </label>
              <button id="place-order" disabled={busy() || !cart().items.length}>
                Place demo order
              </button>
            </form>
            <p>No payment is collected. This is a local checkout fixture.</p>
          </section>
        </div>
      </main>
    </>
  );
}
