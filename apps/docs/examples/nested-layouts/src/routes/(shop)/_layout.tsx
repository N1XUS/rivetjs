import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";

// #region demo
// A layout inside the (shop) folder wraps only the pages in that folder.
// The folder name is in brackets, so it adds nothing to the URL.
export default function ShopLayout({ children }: LayoutProps) {
  const inStock = signal(false);
  return (
    <div class="flex gap-4">
      <aside class="w-40 text-sm">
        <button id="filter" type="button" class="underline" onClick={() => inStock.update((on) => !on)}>
          Only in stock: {inStock() ? "on" : "off"}
        </button>
      </aside>
      <section class="flex-1">{children}</section>
    </div>
  );
}
// #endregion
