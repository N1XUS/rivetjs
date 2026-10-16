// Port of the Angular CDK docs example "sort-predicate" (angular/angular adev/src/content/examples/drag-drop/src/sort-predicate), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Sort predicate" };

// #region demo
export default function DragDropSortPredicate() {
  const numbers = signal([1, 2, 3, 4, 5, 6, 7, 8]);
  return (
    <DropList
      id="numbers"
      class="example-list"
      onDropped={(event) => {
        const next = numbers().slice();
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        numbers.set(next);
      }}
      // Even numbers only sort into even positions (1-based), odd numbers into odd ones.
      sortPredicate={(index, drag) => (index + 1) % 2 === drag.data % 2}
    >
      <For each={numbers} by={(n) => n}>
        {(n) => (
          <Drag id={"n" + n()} data={n()} class="example-box">
            {n()}
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
