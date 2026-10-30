import { load, notFound, type RequestEvent, type PageProps } from "@rivetjs/router";
import { productFor } from "../../../server/service.server.ts";
import { SiteNav } from "../../../sites/SiteNav.tsx";
import { money } from "../../../sites/client.ts";
export const loader = load((e: RequestEvent) => {
  const product = productFor(e.params.sku);
  if (!product) throw notFound();
  return { product };
});
export default function Product({ data }: PageProps<typeof loader>) {
  return (
    <>
      <SiteNav />
      <main class="product-detail">
        <div class={`product-art tone-${data.product.category.toLowerCase()}`}>
          <strong>{data.product.name.split(" ")[0]}</strong>
        </div>
        <section>
          <p class="eyebrow">{data.product.category}</p>
          <h1>{data.product.name}</h1>
          <p>{data.product.description}</p>
          <h2>{money(data.product.price)}</h2>
          <p id="stock">{data.product.stock} in stock</p>
          <a href="/store" class="text-link">
            Back to collection
          </a>
        </section>
      </main>
    </>
  );
}
