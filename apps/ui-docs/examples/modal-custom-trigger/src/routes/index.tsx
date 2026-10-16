// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/custom-trigger.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Settings } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Custom Trigger" };

// #region demo
export function CustomTrigger() {
  return (
    <Modal>
      <Modal.Trigger class="group flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-xs select-none hover:bg-surface-secondary">
        <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
          <Icon icon={Settings} class="size-6" />
        </div>
        <div class="flex flex-1 flex-col gap-0.5">
          <p class="text-sm font-semibold">Settings</p>
          <p class="text-xs text-muted">Manage your preferences</p>
        </div>
      </Modal.Trigger>
      <Modal.Content class="sm:max-w-[360px]">
        <Modal.Header>
          <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
            <Icon icon={Settings} class="size-5" />
          </Modal.Icon>
          <Modal.Heading>Settings</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <p>
            Use <code>Modal.Trigger</code> to create custom trigger elements beyond standard buttons. This example shows a card-style trigger with icons and
            descriptive text.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button slot="close">Save</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomTrigger />
    </div>
  );
}
