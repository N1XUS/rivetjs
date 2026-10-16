import { computed, signal } from "@rivetjs/reactivity";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";

export const head = { title: "GridList: empty state" };

const fruits = ["Apple", "Banana", "Cherry", "Grape"];

// #region demo
export default function Search() {
  const query = signal("");
  const results = computed(() => fruits.filter((f) => f.toLowerCase().includes(query().toLowerCase())).map((name) => ({ id: name.toLowerCase(), name })));
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <input
        id="search-query"
        aria-label="Search"
        placeholder="Search fruit"
        class="rounded-md border border-slate-300 px-2 py-1"
        onInput={(e) => query.set((e.target as HTMLInputElement).value)}
      />
      <GridList
        id="results"
        aria-label="Search results"
        items={results}
        renderEmptyState={() => <p class="p-2 text-slate-500">No results found.</p>}
        class="grid min-h-16 gap-0.5 rounded-lg border border-slate-200 p-1 outline-none data-[empty]:border-dashed"
      >
        {(item: { id: string; name: string }) => (
          <GridListItem class="rounded-md px-2 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500">{item.name}</GridListItem>
        )}
      </GridList>
    </section>
  );
}
// #endregion
