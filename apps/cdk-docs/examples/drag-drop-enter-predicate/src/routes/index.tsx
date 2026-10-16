// Port of the Angular CDK docs example "enter-predicate" (angular/angular adev/src/content/examples/drag-drop/src/enter-predicate), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray, transferArrayItem } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Enter predicate" };

// #region demo
type Key = "all" | "even";

export default function DragDropEnterPredicate() {
  const lists = { all: signal([1, 2, 3, 4, 5, 6, 7, 8, 9]), even: signal([10]) };
  const drop = {
    onDropped: (event: { previousContainer: { data: unknown }; container: { data: unknown }; previousIndex: number; currentIndex: number }) => {
      const from = lists[event.previousContainer.data as Key];
      const to = lists[event.container.data as Key];
      const source = from().slice();
      if (from === to) {
        moveItemInArray(source, event.previousIndex, event.currentIndex);
        to.set(source);
      } else {
        const target = to().slice();
        transferArrayItem(source, target, event.previousIndex, event.currentIndex);
        from.set(source);
        to.set(target);
      }
    },
  };
  return (
    <>
      <div class="example-container">
        <h2>Available numbers</h2>
        <DropList
          id="all"
          data="all"
          connectedTo="even"
          class="example-list"
          onDropped={(event) => drop.onDropped(event)}
          // Predicate that doesn't allow items to be dropped into the list.
          enterPredicate={() => false}
        >
          <For each={lists.all} by={(n) => n}>
            {(n) => (
              <Drag id={"n" + n()} data={n()} class="example-box">
                {n()}
              </Drag>
            )}
          </For>
        </DropList>
      </div>
      <div class="example-container">
        <h2>Even numbers</h2>
        <DropList
          id="even"
          data="even"
          connectedTo="all"
          class="example-list"
          onDropped={(event) => drop.onDropped(event)}
          // Predicate that only allows even numbers to be dropped into the list.
          enterPredicate={(drag) => drag.data % 2 === 0}
        >
          <For each={lists.even} by={(n) => n}>
            {(n) => (
              <Drag id={"n" + n()} data={n()} class="example-box">
                {n()}
              </Drag>
            )}
          </For>
        </DropList>
      </div>
    </>
  );
}
// #endregion
