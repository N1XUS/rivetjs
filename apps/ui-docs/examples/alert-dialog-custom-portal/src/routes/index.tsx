// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-portal.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { PortalProvider } from "@rivetjs/cdk/portal";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Custom Portal" };

// #region demo
export function CustomPortal() {
  return (
    <div class="flex flex-col gap-4">
      <div>
        <p class="text-sm">
          Render alert dialogs inside a custom container instead of <code>document.body</code>
        </p>
        <p class="text-sm text-muted">
          Apply <code class="rounded px-1 py-0.5 text-xs">transform: translateZ(0)</code> to the container to create a new stacking context.
        </p>
      </div>
      <div
        id="alert-dialog-portal-container"
        class="relative flex h-[380px] items-center justify-center overflow-hidden rounded bg-muted/20"
        // new stacking context
        style={{ transform: "translate(0)" }}
      >
        <PortalProvider container="#alert-dialog-portal-container">
          <AlertDialog>
            <Button>Open Alert Dialog</Button>
            <AlertDialog.Backdrop class="h-full">
              <AlertDialog.Container class="h-full max-h-full">
                <AlertDialog.Dialog class="h-full max-h-full sm:max-w-md">
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon status="accent" />
                    <AlertDialog.Heading>Custom Portal</AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    <p class="text-sm text-muted">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
                      minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <p class="text-sm text-muted">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
                      minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <p class="text-sm text-muted">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad
                      minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
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
        </PortalProvider>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomPortal />
    </div>
  );
}
