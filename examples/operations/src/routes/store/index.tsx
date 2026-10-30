import { load, headers, type RequestEvent, type PageProps } from "@rivetjs/router";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { catalog, sessionUser } from "../../server/service.server.ts";
import { SiteNav } from "../../sites/SiteNav.tsx";
import { money, request } from "../../sites/client.ts";
export const loader = load((e: RequestEvent) => ({
  products: catalog(e.url.searchParams.get("q") ?? "", e.url.searchParams.get("category") ?? "All", e.url.searchParams.get("sort") ?? "name"),
  q: e.url.searchParams.get("q") ?? "",
  category: e.url.searchParams.get("category") ?? "All",
  sort: e.url.searchParams.get("sort") ?? "name",
  authenticated: Boolean(sessionUser(e.cookies.get("case-session"))),
}));
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store", vary: "Cookie" }));
export const head = {
  title: "Fieldshop · Tools for everyday work",
  meta: [{ name: "description", content: "Considered essentials for the workspace and the journey." }],
};
export default function Store({ data }: PageProps<typeof loader>) {
  const notice = signal("");
  async function add(sku: string) {
    if (!data.authenticated) return location.assign("/sign-in");
    try {
      const cart = await request<{ version: number; items: { product: { sku: string }; quantity: number }[] }>("/store/api/cart");
      const quantity = (cart.items.find((i) => i.product.sku === sku)?.quantity ?? 0) + 1;
      await request("/store/api/cart", "PUT", { version: cart.version, sku, quantity });
      notice.set("Added to your bag");
    } catch (e) {
      notice.set(String(e));
    }
  }
  return (
    <>
      <SiteNav />
      <main class="store-main">
        <header class="shop-hero">
          <p class="eyebrow">FIELD NOTES / COLLECTION 04</p>
          <h1>
            Less noise.
            <br />
            Better everyday things.
          </h1>
          <p>Useful objects for focused work, slow mornings, and everything in between.</p>
          <a href="#collection" class="text-link">
            Explore the collection
          </a>
        </header>
        <form method="get" class="filter-bar" id="shop-filters">
          <label>
            Find something
            <input id="shop-search" name="q" value={data.q} placeholder="Notebook, bag, lamp…" />
          </label>
          <label>
            Collection
            <select id="shop-category" name="category" value={data.category}>
              <option>All</option>
              <option>Equipment</option>
              <option>Workspace</option>
              <option>Wear</option>
            </select>
          </label>
          <label>
            Sort
            <select id="shop-sort" name="sort" value={data.sort}>
              <option value="name">Name</option>
              <option value="price">Price</option>
            </select>
          </label>
          <button id="shop-filter">Apply</button>
        </form>
        <p id="shop-notice" role="status">
          {notice()}
        </p>
        <p id="product-count">{data.products.length} considered essentials</p>
        <div id="collection" class="product-grid">
          <For each={data.products} by={(p) => p.sku}>
            {(p) => (
              <article class="product-card" data-product={p().sku}>
                <a href={`/store/products/${p().sku}`} class={`product-art tone-${p().category.toLowerCase()}`}>
                  <span>{p().category}</span>
                  <strong>{p().name.split(" ")[0]}</strong>
                </a>
                <div class="product-info">
                  <div>
                    <h2>
                      <a href={`/store/products/${p().sku}`}>{p().name}</a>
                    </h2>
                    <span>{p().category}</span>
                  </div>
                  <strong>{money(p().price)}</strong>
                </div>
                <button class="add-to-cart" disabled={p().stock === 0} onClick={() => void add(p().sku)}>
                  {p().stock === 0 ? "Out of stock" : "Add to bag"}
                </button>
              </article>
            )}
          </For>
        </div>
        {data.products.length === 0 ? <p id="no-products">Nothing matches these filters.</p> : null}
        <footer class="site-footer">Built for daily use. A local test storefront; no real purchases.</footer>
      </main>
    </>
  );
}
