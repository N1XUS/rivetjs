// Port of the Angular CDK docs example "boundary" (angular/angular adev/src/content/examples/drag-drop/src/boundary), MIT, © Google LLC.
import { Drag } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Boundary" };

// #region demo
export default function DragDropBoundary() {
  return (
    <div id="boundary" class="example-boundary">
      <Drag id="box" class="example-box" boundaryElement=".example-boundary">
        I can only be dragged within the dotted container
      </Drag>
    </div>
  );
}
// #endregion
