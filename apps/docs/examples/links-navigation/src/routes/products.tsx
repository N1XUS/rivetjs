import { setSearchParams, useSearchParams } from "@rivetjs/router/client";

export const head = { title: "Products" };

const products = [
  { name: "Lamp", price: 40 },
  { name: "Chair", price: 120 },
  { name: "Desk", price: 300 },
];

// #region demo
export default function Products() {
  // Call it while the component is set up; read it in bindings.
  const search = useSearchParams();
  const sort = () => search().get("sort") ?? "name";
  return (
    <section>
      <h1 class="text-xl font-semibold">Products</h1>
      <p id="sorted" class="mt-2 text-sm">
        Sorted by {sort()}.
      </p>
      <div class="mt-2 flex gap-2">
        <button id="by-name" type="button" class="rounded bg-slate-200 px-2 py-1" onClick={() => setSearchParams({ sort: "name" })}>
          By name
        </button>
        <button id="by-price" type="button" class="rounded bg-slate-200 px-2 py-1" onClick={() => setSearchParams({ sort: "price" })}>
          By price
        </button>
      </div>
      <ul id="list" class="mt-2 list-disc pl-5">
        {[...products]
          .sort((a, b) => (sort() === "price" ? a.price - b.price : a.name.localeCompare(b.name)))
          .map((p) => (
            <li>
              {p.name}: {p.price} €
            </li>
          ))}
      </ul>
    </section>
  );
}
// #endregion
