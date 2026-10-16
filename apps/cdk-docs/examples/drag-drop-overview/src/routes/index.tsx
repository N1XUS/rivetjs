// Port of the Angular CDK docs example "overview" (angular/angular adev/src/content/examples/drag-drop/src/overview), MIT, © Google LLC.
import { Drag } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Free dragging" };

// #region demo
export default function DragDropOverview() {
  return (
    <Drag id="box" class="example-box">
      Drag me around
    </Drag>
  );
}
// #endregion
