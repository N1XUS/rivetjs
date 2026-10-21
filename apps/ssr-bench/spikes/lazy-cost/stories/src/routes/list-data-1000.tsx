import { createListData } from "@rivetjs/cdk/data";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox data 1000" };

interface Animal {
  id: number;
  name: string;
}

// `/list-data`'s first ListBox (createListData, multiple selection) at 1000 items: 1000 component rows (`renderNodeAt`).
// `#ld-move` (LAZY-FLIP): a keyed update that moves the last 50 rows to the top (above the list: in the viewport).
export default function ListData1000() {
  const list = createListData<Animal>({ initialItems: Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, name: "Animal number " + (i + 1) })) });
  return (
    <section>
      <button
        id="ld-move"
        onClick={() =>
          list.moveBefore(
            1,
            Array.from({ length: 50 }, (_, i) => 951 + i),
          )
        }
      >
        Move 50
      </button>
      <ListBox id="ld-animals" aria-label="Animals" selectionMode="multiple" items={list.items}>
        {(animal: Animal) => (
          <ListBoxItem id={animal.id} textValue={animal.name}>
            {animal.name}
          </ListBoxItem>
        )}
      </ListBox>
      <button id="ld-shout" onClick={() => list.update(2, (prev) => ({ ...prev, name: prev.name.toUpperCase() }))}>
        Uppercase
      </button>
    </section>
  );
}
