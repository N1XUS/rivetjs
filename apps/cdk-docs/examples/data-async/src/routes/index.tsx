import { createAsyncList } from "@rivetjs/cdk/data";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";

export const head = { title: "createAsyncList" };

interface Planet {
  id: string;
  name: string;
}

const planets: Planet[] = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"].map((name) => ({ id: name.toLowerCase(), name }));

// #region demo
export default function Planets() {
  const list = createAsyncList<Planet, number>({
    // A fake API (no network): pages of 4, filtered by filterText; the cursor is the next offset.
    load: async ({ cursor, filterText, signal }) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (signal.aborted) throw new Error("aborted");
      const matches = planets.filter((planet) => planet.name.toLowerCase().includes((filterText ?? "").toLowerCase()));
      const start = cursor ?? 0;
      return { items: matches.slice(start, start + 4), cursor: start + 4 < matches.length ? start + 4 : undefined };
    },
    // Client-side sorting of the loaded items (without `sort`, load() receives the sortDescriptor).
    sort: ({ items, sortDescriptor }) => ({
      items: items.slice().sort((a, b) => (sortDescriptor.direction === "ascending" ? 1 : -1) * a.name.localeCompare(b.name)),
    }),
  });
  const button = "rounded border border-slate-300 px-2 py-0.5 hover:bg-slate-100";
  const sorted = () => list.sortDescriptor();
  return (
    <section class="m-4 grid max-w-sm gap-2 text-sm">
      <input
        id="planets-filter"
        aria-label="Filter planets"
        placeholder="Filter…"
        class="rounded border border-slate-300 px-2 py-1"
        onInput={(e) => list.setFilterText((e.currentTarget as HTMLInputElement).value)}
      />
      <ListBox
        id="planets"
        aria-label="Planets"
        items={list.items}
        selectionMode="single"
        selectedKeys={list.selectedKeys}
        renderEmptyState={() => <span class="p-2 text-slate-500">{list.isLoading() ? "Loading…" : "No planets"}</span>}
        class="grid min-h-24 gap-0.5 rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(planet: Planet) => (
          <ListBoxItem id={planet.id} textValue={planet.name} class="rounded px-2 py-1 outline-none aria-selected:bg-sky-100">
            {planet.name}
          </ListBoxItem>
        )}
      </ListBox>
      <div class="flex flex-wrap gap-2">
        <button id="planets-more" class={button} onClick={() => list.loadMore()}>
          Load more
        </button>
        <button
          id="planets-sort"
          class={button}
          onClick={() => list.sort({ column: "name", direction: sorted()?.direction === "ascending" ? "descending" : "ascending" })}
        >
          Sort by name
        </button>
        <button id="planets-reload" class={button} onClick={() => list.reload()}>
          Reload
        </button>
      </div>
      <output id="planets-state">State: {list.loadingState()}</output>
      <output id="planets-count">{list.items().length} loaded</output>
      <output id="planets-sort-state">Sort: {sorted() ? `${String(sorted()!.column)} ${sorted()!.direction}` : "none"}</output>
    </section>
  );
}
// #endregion
