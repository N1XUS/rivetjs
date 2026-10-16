import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Pressable } from "@rivetjs/cdk/interactions/pressable";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Modal with a custom trigger" };

// #region demo
export default function CustomTrigger() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        {/* Pressable passes the press, focus and trigger props to its child. */}
        <Pressable>
          {(props) => (
            <span {...props} id="mct-trigger" role="button" class="cursor-pointer underline decoration-dotted">
              Custom trigger
            </span>
          )}
        </Pressable>
        <Modal>
          <Dialog id="mct">
            <Heading slot="title" class="m-0 text-base font-semibold">
              Dialog
            </Heading>
            <p>This dialog was triggered by a custom button.</p>
            <Button id="mct-close" slot="close">
              Close
            </Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </section>
  );
}
// #endregion
