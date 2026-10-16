// Port of the Angular CDK docs example "root-element" (angular/angular adev/src/content/examples/drag-drop/src/root-element), MIT, © Google LLC.
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Drag } from "@rivetjs/cdk/drag-drop";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Custom root element" };

// #region demo
export default function DragDropRootElement() {
  return (
    <DialogTrigger>
      <Button id="open">Open a draggable dialog</Button>
      {/* Upstream: an Overlay with a backdrop; a press on the backdrop closes it. */}
      <Modal isDismissable class="example-dialog">
        <Dialog id="dialog" aria-label="Draggable dialog">
          {() => (
            <Drag id="dialog-content" class="example-dialog-content" rootElementSelector=".example-dialog">
              Drag the dialog around!
            </Drag>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
// #endregion
