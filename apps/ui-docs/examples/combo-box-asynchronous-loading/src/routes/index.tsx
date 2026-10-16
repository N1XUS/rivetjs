// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/asynchronous-loading.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Collection } from "@rivetjs/cdk/collections/components";
import { createAsyncList } from "@rivetjs/cdk/data";
import { ListBoxLoadMoreItem } from "@rivetjs/cdk/listbox";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "ComboBox: Asynchronous Loading" };

// #region demo
interface Character {
  name: string;
}

export function AsynchronousLoading() {
  const list = createAsyncList<Character>({
    getKey: (item) => item.name,
    load: async ({ cursor, filterText, signal }) => {
      if (cursor) {
        cursor = cursor.replace(/^http:\/\//i, "https://");
      }

      const res = await fetch(cursor || `https://swapi.py4e.com/api/people/?search=${filterText}`, {
        signal,
      });
      const json = await res.json();

      return {
        cursor: json.next,
        items: json.results,
      };
    },
  });

  return (
    <ComboBox allowsEmptyCollection class="w-[256px]" onInputChange={(value) => list.setFilterText(value)}>
      <Label>Pick a Character</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Star Wars characters..." />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox renderEmptyState={() => <EmptyState />}>
          <Collection items={list.items}>
            {(item: Character) => (
              <ListBox.Item id={item.name} textValue={item.name}>
                {item.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </Collection>
          <ListBoxLoadMoreItem isLoading={() => list.loadingState() === "loadingMore"} onLoadMore={() => list.loadMore()}>
            <div class="flex items-center justify-center gap-2 py-2">
              <Spinner size="sm" />
              <span class="muted text-sm">Loading more...</span>
            </div>
          </ListBoxLoadMoreItem>
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
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
