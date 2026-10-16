// Port of the Angular CDK docs example "disable-drag" (angular/angular adev/src/content/examples/drag-drop/src/disable-drag), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Disabled dragging" };

// #region demo
const ITEMS = [
  { id: "first", value: "I can be dragged", disabled: false },
  { id: "second", value: "I cannot be dragged", disabled: true },
  { id: "third", value: "I can also be dragged", disabled: false },
];

export default function DragDropDisabled() {
  const items = signal(ITEMS);
  return (
    <DropList
      id="items"
      class="example-list"
      onDropped={(event) => {
        const next = items().slice();
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        items.set(next);
      }}
    >
      <For each={items} by={(item) => item.id}>
        {(item) => (
          <Drag id={item().id} class="example-box" disabled={item().disabled}>
            {item().value}
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
