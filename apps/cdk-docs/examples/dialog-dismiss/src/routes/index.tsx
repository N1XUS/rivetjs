import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Dismissing a modal" };

// #region demo
export default function Dismiss() {
  return (
    <section class="m-4 flex flex-wrap gap-2 text-sm">
      <DialogTrigger>
        <Button id="light-trigger">Dismissable</Button>
        <Modal isDismissable>
          <Dialog id="light">
            <Heading slot="title">Click outside to close</Heading>
            <p>A click on the underlay closes it.</p>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="plain-trigger">Default</Button>
        <Modal>
          <Dialog id="plain">
            <Heading slot="title">Escape only</Heading>
            <p>The underlay ignores clicks; Escape closes.</p>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="locked-trigger">Locked</Button>
        <Modal isDismissable isKeyboardDismissDisabled>
          <Dialog id="locked">
            <Heading slot="title">Finish first</Heading>
            <Button id="locked-done" slot="close" class="mt-3 rounded bg-teal-700 px-3 py-1 text-white">
              Done
            </Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="filtered-trigger">Filtered</Button>
        <Modal
          isDismissable
          // An inline arrow, so the re-created overlay can call it. `true` closes.
          shouldCloseOnInteractOutside={(element: Element) => !element.classList.contains("rv-ModalOverlay")}
        >
          <Dialog id="filtered">
            <Heading slot="title">Underlay ignored</Heading>
            <p>Outside interactions on the underlay are filtered out.</p>
          </Dialog>
        </Modal>
      </DialogTrigger>
    </section>
  );
}
// #endregion
