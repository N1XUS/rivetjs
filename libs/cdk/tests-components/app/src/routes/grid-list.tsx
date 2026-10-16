import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Text } from "@rivetjs/cdk/text";
import { createListData } from "@rivetjs/cdk/data";
import type { Key, Selection } from "@rivetjs/cdk/types";

export const head = { title: "GridList" };

export default function GridListStory() {
  const selected = signal<Selection>(new Set<Key>(["cat"]));
  const action = signal("none");
  const show = signal(false);
  const list = createListData({
    initialItems: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
      { id: "c", name: "Charlie" },
    ],
  });
  const stack = createListData({
    initialItems: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Bravo" },
      { id: "c", name: "Charlie" },
    ],
  });
  return (
    <section>
      <h1>GridList</h1>
      <GridList
        id="gl-pets"
        aria-label="Pets"
        selectionMode="multiple"
        selectedKeys={selected}
        onAction={(key) => action.set(String(key))}
        disabledKeys={["fish"]}
      >
        <GridListItem id="cat" textValue="Cat">
          Cat
        </GridListItem>
        <GridListItem id="dog" textValue="Dog">
          Dog
        </GridListItem>
        <GridListItem id="fish" textValue="Fish">
          Fish
        </GridListItem>
      </GridList>
      <output id="gl-pets-selected">{selected() === "all" ? "all" : [...(selected() as Set<Key>)].join(",")}</output>
      <output id="gl-pets-action">{action()}</output>
      <GridList id="gl-data" aria-label="Data" items={list.items} layout="grid">
        {(item: { id: string; name: string }) => (
          <GridListItem id={item.id} textValue={item.name}>
            {item.name}
            <Button aria-label={"Remove " + item.name} onPress={() => list.remove(item.id)}>
              Remove
            </Button>
          </GridListItem>
        )}
      </GridList>
      {/* Default (stack) layout: remove a row from its own Button. */}
      <GridList id="gl-stack" aria-label="Stack" items={stack.items}>
        {(item: { id: string; name: string }) => (
          <GridListItem id={item.id} textValue={item.name}>
            {item.name}
            <Button aria-label={"Remove " + item.name} onPress={() => stack.remove(item.id)}>
              Remove
            </Button>
          </GridListItem>
        )}
      </GridList>
      {/* Rows with a description slot: aria-labelledby keeps pointing at the row + description ids after a selection change. */}
      <GridList id="gl-desc" aria-label="Described" selectionMode="multiple">
        <GridListItem id="d1" textValue="Alpha">
          Alpha
          <Text slot="description">First</Text>
        </GridListItem>
        <GridListItem id="d2" textValue="Bravo">
          Bravo
          <Text slot="description">Second</Text>
        </GridListItem>
      </GridList>
      <button id="gl-after">After</button>
      {/* Port of RAC GridList.ssr.test.js: server rows, then a conditional item inserted in place after resume. */}
      <button id="gl-ssr-show" onClick={() => show.set(true)}>
        Show
      </button>
      <GridList id="gl-ssr" aria-label="GridList">
        <GridListItem id="1">Left</GridListItem>
        <GridListItem id="2">Middle</GridListItem>
        <Show when={show}>
          <GridListItem id="4">Extra</GridListItem>
        </Show>
        <GridListItem id="3">Right</GridListItem>
      </GridList>
    </section>
  );
}
