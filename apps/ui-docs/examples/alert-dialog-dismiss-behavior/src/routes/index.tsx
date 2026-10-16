// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/dismiss-behavior.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Info } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Dismiss Behavior" };

// #region demo
export function DismissBehavior() {
  return (
    <div class="flex max-w-sm flex-col gap-6">
      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">isDismissable</h3>
        <p class="text-sm text-muted">
          Controls whether the alert dialog can be dismissed by clicking the overlay backdrop. Alert dialogs typically require explicit action, so this defaults
          to <code>false</code>. Set to <code>true</code> for less critical confirmations.
        </p>
        <AlertDialog>
          <Button variant="secondary">Open Alert Dialog</Button>
          <AlertDialog.Backdrop isDismissable={false}>
            <AlertDialog.Container>
              <AlertDialog.Dialog class="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="danger">
                    <Icon icon={Info} class="size-5" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>isDismissable = false</AlertDialog.Heading>
                  <p class="text-sm leading-5 text-muted">Clicking the backdrop won't close this alert dialog</p>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>Try clicking outside this alert dialog on the overlay - it won't close. You must use the action buttons to dismiss it.</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    Cancel
                  </Button>
                  <Button slot="close">Confirm</Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </div>

      <div class="flex flex-col gap-2">
        <h3 class="text-lg font-semibold">isKeyboardDismissDisabled</h3>
        <p class="text-sm text-muted">
          Controls whether the ESC key can dismiss the alert dialog. Alert dialogs typically require explicit action, so this defaults to <code>true</code>.
          When set to <code>false</code>, the ESC key will be enabled.
        </p>
        <AlertDialog>
          <Button variant="secondary">Open Alert Dialog</Button>
          <AlertDialog.Backdrop isKeyboardDismissDisabled>
            <AlertDialog.Container>
              <AlertDialog.Dialog class="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="accent">
                    <Icon icon={Info} class="size-5" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>isKeyboardDismissDisabled = true</AlertDialog.Heading>
                  <p class="text-sm leading-5 text-muted">ESC key is disabled</p>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>Press ESC - nothing happens. You must use the action buttons to dismiss this alert dialog.</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary">
                    Cancel
                  </Button>
                  <Button slot="close">Confirm</Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
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
