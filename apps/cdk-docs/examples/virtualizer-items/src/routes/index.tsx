import { signal } from "@rivetjs/reactivity";
import { Virtualizer, ListLayout } from "@rivetjs/cdk/virtualizer";

export const head = { title: "Virtualizer: reactive items" };

const products = Array.from({ length: 10000 }, (_, i) => ({ sku: `sku-${i}`, name: `Product ${i}` }));

// #region demo
export default function Products() {
  const query = signal("");
  const top = signal(0);
  const visible = () => (query() ? products.filter((p) => p.name.includes(query())) : products);
  return (
    <section class="stack">
      <label>
        Filter <input id="products-filter" type="search" value={query()} onInput={(event) => query.set((event.currentTarget as HTMLInputElement).value)} />
      </label>
      <Virtualizer
        id="products"
        role="list"
        label="Products"
        tabIndex={0}
        items={visible}
        getKey={(product) => product.sku}
        getTextValue={(product) => product.name}
        layout={() => new ListLayout()}
        layoutOptions={{ rowSize: 32 }}
        initialSize={{ width: 320, height: 240 }}
        style={{ width: "320px", height: "240px" }}
        onScroll={(event) => top.set((event.currentTarget as HTMLElement).scrollTop)}
      >
        {(product) => (
          <div role="listitem" class="row">
            {product().name}
          </div>
        )}
      </Virtualizer>
      <output id="products-count">
        {visible().length} of {products.length}
      </output>
      <output id="products-top">scrollTop: {top()}</output>
    </section>
  );
}
// #endregion
