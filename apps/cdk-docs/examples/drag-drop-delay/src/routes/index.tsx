// Port of the Angular CDK docs example "delay-drag" (angular/angular adev/src/content/examples/drag-drop/src/delay-drag), MIT, © Google LLC.
import { Drag } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Delayed dragging" };

// #region demo
export default function DragDropDelay() {
  return (
    <Drag id="box" class="example-box" dragStartDelay={1000}>
      Dragging starts after one second
    </Drag>
  );
}
// #endregion
