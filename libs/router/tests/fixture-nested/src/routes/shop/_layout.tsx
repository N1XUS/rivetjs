import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { invalidate, useParams } from "@rivetjs/router/client";

// Nested layout: stays mounted across /shop/* navigation (counter and input survive).
export default function ShopLayout({ data, url, children }: LayoutProps<{ loads: number }>) {
  const count = signal(0);
  const params = useParams();
  return (
    <section id="shop">
      <h2>Shop</h2>
      <button type="button" id="shop-count" onClick={() => count.update((n) => n + 1)}>
        Count {count()}
      </button>
      <input id="shop-input" />
      <p id="shop-loads">{data().loads}</p>
      <p id="shop-url">{url().pathname + url().search}</p>
      <p id="shop-params">{JSON.stringify(params())}</p>
      <button type="button" id="shop-invalidate" onClick={() => invalidate().then(() => (document.documentElement.dataset.done = "fresh"))}>
        Invalidate
      </button>
      <div id="shop-page">{children}</div>
    </section>
  );
}
