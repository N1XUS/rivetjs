import { signal } from "@rivetjs/reactivity";
import { Plus, Trash2 } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { createListData } from "@rivetjs/cdk/data";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Text } from "@rivetjs/cdk/text";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "GridList: dynamic items" };

interface Photo {
  id: string;
  title: string;
  user: string;
}

const initial: Photo[] = [
  { id: "leaf", title: "A Ficus Lyrata Leaf", user: "Clay Banks" },
  { id: "beach", title: "Italian beach", user: "Alan Bajura" },
  { id: "road", title: "Forest road", user: "Artem Stoliar" },
];

const button = "flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 disabled:opacity-40";

// #region demo
export default function Photos() {
  const list = createListData<Photo>({ initialItems: initial });
  const next = signal(1);
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      <GridList
        id="photos"
        aria-label="Photos"
        layout="grid"
        selectionMode="multiple"
        items={list.items}
        selectedKeys={list.selectedKeys}
        onSelectionChange={(keys) => list.setSelectedKeys(keys)}
        class="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1 outline-none"
      >
        {(photo: Photo) => (
          <GridListItem
            id={photo.id}
            textValue={photo.title}
            class="grid cursor-default rounded-md border border-slate-200 p-2 outline-none data-[selected]:border-sky-600 data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500"
          >
            <Text class="font-medium">{photo.title}</Text>
            <Text slot="description" class="text-xs text-slate-500">
              by {photo.user}
            </Text>
            <Button
              aria-label={"Delete " + photo.title}
              class="grid size-6 place-items-center justify-self-end rounded hover:bg-slate-100"
              onPress={() => list.remove(photo.id)}
            >
              <Icon icon={Trash2} size={14} />
            </Button>
          </GridListItem>
        )}
      </GridList>
      <div class="flex gap-2">
        <Button
          id="photos-add"
          class={button}
          onPress={() => {
            const n = next();
            next.set(n + 1);
            list.append({ id: "new-" + n, title: "New photo " + n, user: "You" });
          }}
        >
          <Icon icon={Plus} size={14} /> Add photo
        </Button>
        <Button id="photos-remove" class={button} onPress={() => list.removeSelectedItems()}>
          <Icon icon={Trash2} size={14} /> Remove selected
        </Button>
      </div>
    </section>
  );
}
// #endregion
