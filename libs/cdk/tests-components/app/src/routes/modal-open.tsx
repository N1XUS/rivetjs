import { signal } from "@rivetjs/reactivity";
import { Modal, ModalOverlay, OverlayProvider } from "@rivetjs/cdk/modal";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";

export const head = { title: "Modal open on load" };

// A modal open on the server render with JSX heading / children and a signal isOpen, inside an
// OverlayProvider with JSX children: the spread underlay / provider elements must not capture the
// props object (its JSX is not serializable).
export default function ModalOpenStory() {
  const open = signal(true);
  return (
    <OverlayProvider id="mo-provider" class="mo-provider">
      <h1>
        <b>Modal open on load</b>
      </h1>
      <p id="mo-open">{String(open())}</p>
      <ModalOverlay isOpen={open} onOpenChange={(v: boolean) => open.set(v)} isDismissable class="mo-overlay" lang="en">
        <Modal id="mo-modal">
          <Dialog>
            <Heading slot="title">
              <b>JSX title</b>
            </Heading>
            <p id="mo-body">
              <b>JSX body</b>
            </p>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </OverlayProvider>
  );
}
