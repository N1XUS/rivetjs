// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/close-methods.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleCheck, Info } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Close Methods" };

// #region demo
export function CloseMethods() {
  return (
    <div class="flex max-w-2xl flex-col gap-8">
      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">Using slot="close"</h3>
        <p class="text-sm text-muted">
          The simplest way to close a modal. Add <code>slot="close"</code> to any Button component within the modal. When clicked, it will automatically close
          the modal.
        </p>
        <Modal>
          <Button variant="secondary">Open Modal</Button>
          <Modal.Content class="sm:max-w-[360px]" closeButton={false}>
            <Modal.Header>
              <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
                <Icon icon={Info} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Using slot="close"</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>
                Click either button below - both have <code>slot="close"</code> and will close the modal automatically.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Confirm</Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">Using Dialog render props</h3>
        <p class="text-sm text-muted">
          Access the <code>close</code> method from the Dialog's render props. This gives you full control over when and how to close the modal, allowing you to
          add custom logic before closing.
        </p>
        <Modal>
          <Button variant="secondary">Open Modal</Button>
          <Modal.Content class="sm:max-w-[360px]" closeButton={false}>
            {(renderProps) => (
              <>
                <Modal.Header>
                  <Modal.Icon class="bg-success-soft text-success-soft-foreground">
                    <Icon icon={CircleCheck} class="size-5" />
                  </Modal.Icon>
                  <Modal.Heading>Using Dialog render props</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p>
                    The buttons below use the <code>close</code> method from render props. You can add validation or other logic before calling{" "}
                    <code>renderProps.close()</code>.
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="secondary" onPress={() => renderProps.close()}>
                    Cancel
                  </Button>
                  <Button onPress={() => renderProps.close()}>Confirm</Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Content>
        </Modal>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CloseMethods />
    </div>
  );
}
