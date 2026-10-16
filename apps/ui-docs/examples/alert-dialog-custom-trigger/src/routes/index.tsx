// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-trigger.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Trash2 } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Custom Trigger" };

// #region demo
export function CustomTrigger() {
  return (
    <AlertDialog>
      <AlertDialog.Trigger class="group flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-xs select-none hover:bg-surface-secondary">
        <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger-soft-foreground">
          <Icon icon={Trash2} class="size-6" />
        </div>
        <div class="flex flex-1 flex-col gap-0.5">
          <p class="text-sm font-semibold">Delete Item</p>
          <p class="text-xs text-muted">Permanently remove this item</p>
        </div>
      </AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog class="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger">
                <Icon icon={Trash2} class="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>Delete this item?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                Use <code>AlertDialog.Trigger</code> to create custom trigger elements beyond standard buttons. This example shows a card-style trigger with
                icons and descriptive text.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button slot="close" variant="danger">
                Delete Item
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
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
