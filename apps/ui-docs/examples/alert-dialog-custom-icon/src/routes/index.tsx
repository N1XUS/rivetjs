// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { LockOpen } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Custom Icon" };

// #region demo
export function CustomIcon() {
  return (
    <AlertDialog>
      <Button variant="secondary">Reset Password</Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog class="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning">
                <Icon icon={LockOpen} class="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>Reset your password?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>We'll send a password reset link to your email address. You'll need to create a new password to regain access to your account.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button slot="close">Send Reset Link</Button>
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
      <CustomIcon />
    </div>
  );
}
