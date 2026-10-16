import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Account" };

export default function Home() {
  const open = signal(false);
  const deleted = signal(false);
  return (
    <main class="mx-auto max-w-xl p-6">
      <Button id="open" variant="danger" onPress={() => open.set(true)}>
        Delete account
      </Button>
      <Show when={deleted()}>
        <p id="status">Account deleted</p>
      </Show>
      <Modal.Backdrop isOpen={open}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Delete account?</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>This cannot be undone.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button id="cancel" variant="secondary" onPress={() => open.set(false)}>
                Cancel
              </Button>
              <Button
                id="confirm"
                variant="danger"
                onPress={() => {
                  deleted.set(true);
                  open.set(false);
                }}
              >
                Delete
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </main>
  );
}
