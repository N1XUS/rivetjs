// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/dismiss-behavior.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Info } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Dismiss Behavior" };

// #region demo
export function DismissBehavior() {
  return (
    <div class="flex max-w-sm flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">isDismissable</h3>
        <p class="text-sm text-muted">
          Controls whether the modal can be dismissed by clicking the overlay backdrop. Defaults to <code>true</code>. Set to <code>false</code> to require
          explicit close action.
        </p>
        <Modal>
          <Button variant="secondary">Open Modal</Button>
          <Modal.Content isDismissable={false} class="sm:max-w-[360px]">
            <Modal.Header>
              <Modal.Icon class="bg-default text-foreground">
                <Icon icon={Info} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>isDismissable = false</Modal.Heading>
              <p class="text-sm leading-5 text-muted">Clicking the backdrop won't close this modal</p>
            </Modal.Header>
            <Modal.Body>
              <p>Try clicking outside this modal on the overlay - it won't close. You must use the close button or press ESC to dismiss it.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button class="w-full" slot="close">
                Close
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">isKeyboardDismissDisabled</h3>
        <p class="text-sm text-muted">
          Controls whether the ESC key can dismiss the modal. When set to <code>true</code>, the ESC key will be disabled and users must use explicit close
          actions.
        </p>
        <Modal>
          <Button variant="secondary">Open Modal</Button>
          <Modal.Content isKeyboardDismissDisabled class="sm:max-w-[360px]">
            <Modal.Header>
              <Modal.Icon class="bg-default text-foreground">
                <Icon icon={Info} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>isKeyboardDismissDisabled = true</Modal.Heading>
              <p class="text-sm leading-5 text-muted">ESC key is disabled</p>
            </Modal.Header>
            <Modal.Body>
              <p>Press ESC - nothing happens. You must use the close button or click the overlay backdrop to dismiss this modal.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button class="w-full" slot="close">
                Close
              </Button>
            </Modal.Footer>
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
      <DismissBehavior />
    </div>
  );
}
