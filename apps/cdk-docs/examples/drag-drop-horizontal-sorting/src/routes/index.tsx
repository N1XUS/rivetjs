// Port of the Angular CDK docs example "horizontal-sorting" (angular/angular adev/src/content/examples/drag-drop/src/horizontal-sorting), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Drag, DropList, moveItemInArray } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Horizontal sorting" };

// #region demo
const TIME_PERIODS = ["Bronze age", "Iron age", "Middle ages", "Early modern period", "Long nineteenth century"];

export default function DragDropHorizontalSorting() {
  const timePeriods = signal(TIME_PERIODS);
  return (
    <DropList
      id="periods"
      orientation="horizontal"
      class="example-list"
      onDropped={(event) => {
        const next = timePeriods().slice();
        moveItemInArray(next, event.previousIndex, event.currentIndex);
        timePeriods.set(next);
      }}
    >
      <For each={timePeriods} by={(period) => period}>
        {(period) => (
          <Drag id={"period-" + TIME_PERIODS.indexOf(period())} class="example-box">
            {period()}
          </Drag>
        )}
      </For>
    </DropList>
  );
}
// #endregion
