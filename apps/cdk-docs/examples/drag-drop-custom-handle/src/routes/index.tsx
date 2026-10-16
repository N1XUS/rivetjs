// Port of the Angular CDK docs example "custom-handle" (angular/angular adev/src/content/examples/drag-drop/src/custom-handle), MIT, © Google LLC.
import { Move } from "lucide";
import { Drag, DragHandle } from "@rivetjs/cdk/drag-drop";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Drag handle" };

// #region demo
export default function DragDropHandle() {
  return (
    <Drag id="box" class="example-box">
      I can only be dragged using the handle
      <DragHandle id="handle" class="example-handle">
        <Icon icon={Move} size={24} />
      </DragHandle>
    </Drag>
  );
}
// #endregion
