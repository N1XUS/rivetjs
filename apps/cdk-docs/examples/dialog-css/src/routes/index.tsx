import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Dialog with plain CSS" };

// #region demo
export default function PlainCss() {
  return (
    <section style={{ margin: "1rem" }}>
      <DialogTrigger>
        <Button id="css-dialog-trigger">Show terms</Button>
        <Modal isDismissable>
          <Dialog id="css-dialog">
            <Heading slot="title">Terms of use</Heading>
            <p>Styled by a plain stylesheet: no class props at all.</p>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </section>
  );
}
// #endregion
