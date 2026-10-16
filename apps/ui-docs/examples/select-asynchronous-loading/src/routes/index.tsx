// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/asynchronous-loading.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { createAsyncList } from "@rivetjs/cdk/data";
import { Collection } from "@rivetjs/cdk/collections/components";
import { ListBoxLoadMoreItem } from "@rivetjs/cdk/listbox";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Select: Asynchronous Loading" };

// #region demo
interface Pokemon {
  name: string;
}

export function AsynchronousLoading() {
  const list = createAsyncList<Pokemon>({
    getKey: (item) => item.name,
    load: async ({ cursor, signal }) => {
      const res = await fetch(cursor || `https://pokeapi.co/api/v2/pokemon`, { signal });
      const json = await res.json();

      return {
        cursor: json.next,
        items: json.results,
      };
    },
  });

  return (
    <Select class="w-[256px]" placeholder="Select a Pokemon">
      <Label>Pick a Pokemon</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <Collection items={list.items}>
            {(item: Pokemon) => (
              <ListBox.Item id={item.name} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </Collection>
          <ListBoxLoadMoreItem isLoading={() => list.loadingState() === "loadingMore"} onLoadMore={() => list.loadMore()}>
            <div class="flex items-center justify-center gap-2 py-2">
              <Spinner size="sm" />
              <span class="text-sm text-muted">Loading more...</span>
            </div>
          </ListBoxLoadMoreItem>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <AsynchronousLoading />
    </div>
  );
}
