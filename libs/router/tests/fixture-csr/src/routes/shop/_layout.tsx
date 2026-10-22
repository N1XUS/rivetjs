import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

export const head = { titleTemplate: "%s · Shop" };

// Nested layout: stays mounted across /shop/* navigation.
export default function ShopLayout({ url, children }: LayoutProps) {
  const count = signal(0);
  return (
    <section id="shop">
      <button type="button" id="shop-count" onClick={() => count.update((n) => n + 1)}>
        Shop {count()}
      </button>
      <input id="shop-input" />
      <p id="shop-url">{url().pathname}</p>
      <a href="/shop/a">A</a> <a href="/shop/b">B</a> <a href="/about">Leave</a>
      {children}
    </section>
  );
}
