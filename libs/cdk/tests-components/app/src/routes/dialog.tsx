import { DialogTrigger, Dialog } from "@rivetjs/cdk/dialog";
import { Modal } from "@rivetjs/cdk/modal";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "Dialog" };

// RAC composition: DialogTrigger > Button + Modal > Dialog (Heading slot="title", Button slot="close").
export default function DialogStory() {
  return (
    <section>
      <h1>Dialog</h1>
      <DialogTrigger>
        <Button id="settings-trigger">Open settings</Button>
        <Modal isDismissable>
          <Dialog id="settings">
            <Heading slot="title">Settings</Heading>
            <label>
              Name <input id="settings-name" autoFocus />
            </label>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="confirm-trigger">Delete…</Button>
        <Modal>
          <Dialog id="confirm" role="alertdialog">
            <Heading slot="title">Delete the file?</Heading>
            <Text slot="description">This cannot be undone.</Text>
            <Button slot="close">Cancel</Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </section>
  );
}
