// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-backdrop.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { TriangleAlert } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Custom Backdrop" };

// #region demo
export function CustomBackdrop() {
  return (
    <AlertDialog>
      <Button variant="danger">Delete Account</Button>
      <AlertDialog.Backdrop class="bg-linear-to-t from-red-950/90 via-red-950/50 to-transparent dark:from-red-950/95 dark:via-red-950/60" variant="blur">
        <AlertDialog.Container>
          <AlertDialog.Dialog class="sm:max-w-[420px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header class="items-center text-center">
              <AlertDialog.Icon status="danger">
                <Icon icon={TriangleAlert} class="size-5" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>Permanently delete your account?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                This action cannot be undone. All your data, settings, and content will be permanently removed from our servers. The dramatic red backdrop
                emphasizes the severity and irreversibility of this decision.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer class="flex-col-reverse">
              <Button class="w-full" slot="close">
                Keep Account
              </Button>
              <Button class="w-full" slot="close" variant="danger">
                Delete Forever
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
      <CustomBackdrop />
    </div>
  );
}
