// Port of the Angular CDK docs example "connected-sorting-group" (angular/angular adev/src/content/examples/drag-drop/src/connected-sorting-group), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, DropListGroup, moveItemInArray, transferArrayItem } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Connected lists in a group" };

// #region demo
type Key = "todo" | "done";
const slug = (item: string) => item.toLowerCase().replace(/[^a-z]+/g, "-");

export default function DragDropConnectedSortingGroup() {
  const lists = {
    todo: signal(["Get to work", "Pick up groceries", "Go home", "Fall asleep"]),
    done: signal(["Get up", "Brush teeth", "Take a shower", "Check e-mail", "Walk dog"]),
  };
  return (
    <DropListGroup>
      <div class="example-container">
        <h2>To do</h2>
        <DropList
          id="todo-list"
          data="todo"
          class="example-list"
          onDropped={(event) => {
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
          }}
        >
          <For each={lists.todo} by={(item) => item}>
            {(item) => (
              <Drag id={slug(item())} class="example-box">
                {item()}
              </Drag>
            )}
          </For>
        </DropList>
      </div>

      <div class="example-container">
        <h2>Done</h2>
        <DropList
          id="done-list"
          data="done"
          class="example-list"
          onDropped={(event) => {
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
          }}
        >
          <For each={lists.done} by={(item) => item}>
            {(item) => (
              <Drag id={slug(item())} class="example-box">
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
