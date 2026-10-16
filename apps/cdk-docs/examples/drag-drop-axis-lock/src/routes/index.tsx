// Port of the Angular CDK docs example "axis-lock" (angular/angular adev/src/content/examples/drag-drop/src/axis-lock), MIT, © Google LLC.
import { Drag } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Axis lock" };

// #region demo
export default function DragDropAxisLock() {
  return (
    <>
      <Drag id="y-box" class="example-box" lockAxis="y">
        I can only be dragged up/down
      </Drag>
      <Drag id="x-box" class="example-box" lockAxis="x">
        I can only be dragged left/right
      </Drag>
    </>
  );
}
// #endregion
