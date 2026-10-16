import { computed, signal } from "@rivetjs/reactivity";
import { Collection } from "@rivetjs/cdk/collections/components";
import { Cell, Column, Row, Table, TableBody, TableHeader, TableLoadMoreItem } from "@rivetjs/cdk/table";

export const head = { title: "Table: infinite loading" };

const page = (start: number) => Array.from({ length: 10 }, (_, i) => ({ id: start + i + 1, name: "Planet " + (start + i + 1), height: 100 + start + i }));

const th = "sticky top-0 border-b border-slate-200 bg-white px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1.5";

// #region demo
export default function StarWarsPlanets() {
  const count = signal(10);
  const loading = signal(false);
  const items = computed(() => page(0).concat(count() > 10 ? page(10) : [], count() > 20 ? page(20) : []));
  const loadMore = () => {
    if (loading() || count() >= 30) return;
    loading.set(true);
    // Simulated network request.
    setTimeout(() => {
      count.set(count() + 10);
      loading.set(false);
    }, 300);
  };
  return (
    <div id="planets-scroll" class="m-4 h-56 max-w-sm overflow-auto rounded-lg border border-slate-200 text-sm">
      <Table id="planets" aria-label="Star Wars planets" class="w-full border-collapse">
        <TableHeader>
          <Column id="name" isRowHeader class={th}>
            Name
          </Column>
          <Column id="height" class={th}>
            Height
          </Column>
        </TableHeader>
        <TableBody>
          <Collection items={items}>
            {(item: { id: number; name: string; height: number }) => (
              <Row>
                <Cell class={td}>{item.name}</Cell>
                <Cell class={td}>{item.height}</Cell>
              </Row>
            )}
          </Collection>
          <TableLoadMoreItem isLoading={loading} onLoadMore={loadMore} class="text-slate-500">
            Loading more…
          </TableLoadMoreItem>
        </TableBody>
      </Table>
    </div>
  );
}
// #endregion
