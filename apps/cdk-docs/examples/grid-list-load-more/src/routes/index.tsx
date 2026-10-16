import { computed, signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { GridList, GridListItem, GridListLoadMoreItem } from "@rivetjs/cdk/grid-list";

export const head = { title: "GridList: infinite loading" };

const page = (start: number) => Array.from({ length: 8 }, (_, i) => ({ id: start + i + 1, name: "Pokémon #" + (start + i + 1) }));

// #region demo
export default function Pokedex() {
  const count = signal(8);
  const loading = signal(false);
  const items = computed(() => page(0).concat(count() > 8 ? page(8) : [], count() > 16 ? page(16) : []));
  const loadMore = () => {
    if (loading() || count() >= 24) return;
    loading.set(true);
    // Simulated network request.
    setTimeout(() => {
      count.set(count() + 8);
      loading.set(false);
    }, 300);
  };
  return (
    <GridList
      id="pokedex"
      aria-label="Pokémon"
      class="m-4 grid h-48 max-w-xs content-start gap-0.5 overflow-auto rounded-lg border border-slate-200 p-1 text-sm outline-none"
    >
      <Collection items={items}>
        {(item: { id: number; name: string }) => (
          <GridListItem class="rounded px-2 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500">{item.name}</GridListItem>
        )}
      </Collection>
      <GridListLoadMoreItem isLoading={loading} onLoadMore={loadMore} class="px-2 py-1 text-slate-500">
        Loading more…
      </GridListLoadMoreItem>
    </GridList>
  );
}
// #endregion
