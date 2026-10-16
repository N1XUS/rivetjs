// Port of the Angular CDK docs example "mixed-sorting" (angular/angular adev/src/content/examples/drag-drop/src/mixed-sorting), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Wrapping list" };

// #region demo
const ITEMS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

export default function DragDropMixedSorting() {
  const items = signal(ITEMS);
  return (
    <DropList
      id="items"
      orientation="mixed"
      class="example-list"
      onDropped={(event) => {
        const next = items().slice();
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        items.set(next);
      }}
    >
      <For each={items} by={(item) => item}>
        {(item) => (
          <Drag id={item().toLowerCase()} class="example-box">
            {item()}
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
