// Port of the Angular CDK docs example "free-drag-position" (angular/angular adev/src/content/examples/drag-drop/src/free-drag-position), MIT, © Google LLC.
import { signal } from "@rivetjs/reactivity";
import { Drag } from "@rivetjs/cdk/drag-drop";

export const head = { title: "Free drag position" };

// #region demo
export default function DragDropFreeDragPosition() {
  const dragPosition = signal({ x: 0, y: 0 });
  return (
    <>
      <p>
        <button id="change" type="button" onClick={() => dragPosition.set({ x: dragPosition().x + 50, y: dragPosition().y + 50 })}>
          Change element position
        </button>
      </p>
      <Drag id="box" class="example-box" freeDragPosition={dragPosition}>
        Drag me around
      </Drag>
    </>
  );
}
// #endregion
