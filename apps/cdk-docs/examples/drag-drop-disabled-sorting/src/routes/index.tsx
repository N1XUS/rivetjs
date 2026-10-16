// Port of the Angular CDK docs example "disable-sorting" (angular/angular adev/src/content/examples/drag-drop/src/disable-sorting), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, DropListGroup, moveItemInArray, transferArrayItem } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Disabled sorting" };

// #region demo
type Key = "items" | "basket";

export default function DragDropDisabledSorting() {
  const lists = { items: signal(["Carrots", "Tomatoes", "Onions", "Apples", "Avocados"]), basket: signal(["Oranges", "Bananas", "Cucumbers"]) };
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
    <DropListGroup>
      <div class="example-container">
        <h2>Available items</h2>
        <DropList id="items" data="items" class="example-list" sortingDisabled onDropped={(event) => drop.onDropped(event)}>
          <For each={lists.items} by={(item) => item}>
            {(item) => (
              <Drag id={item().toLowerCase()} class="example-box">
                {item()}
              </Drag>
            )}
          </For>
        </DropList>
      </div>
      <div class="example-container">
        <h2>Shopping basket</h2>
        <DropList id="basket" data="basket" class="example-list" onDropped={(event) => drop.onDropped(event)}>
          <For each={lists.basket} by={(item) => item}>
            {(item) => (
              <Drag id={item().toLowerCase()} class="example-box">
                {item()}
              </Drag>
            )}
          </For>
        </DropList>
      </div>
    </DropListGroup>
  );
}
// #endregion
