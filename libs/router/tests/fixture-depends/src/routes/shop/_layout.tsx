import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

// Nested layout (depends "cart"): persisted; its counter survives invalidation.
export default function ShopLayout({ data, children }: LayoutProps<{ loads: number }>) {
  const count = signal(0);
  return (
    <section id="shop">
      <button type="button" id="shop-count" onClick={() => count.update((n) => n + 1)}>
        Count {count()}
      </button>
      <p id="shop-loads">{data().loads}</p>
      <div id="shop-page">{children}</div>
    </section>
  );
}
