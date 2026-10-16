// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/custom-portal.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { PortalProvider } from "@rivetjs/cdk/portal";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Custom Portal" };

// #region demo
export function CustomPortal() {
  return (
    <div class="flex flex-col gap-4">
      <div>
        <p class="text-sm">
          Render modals inside a custom container instead of <code>document.body</code>
        </p>
        <p class="text-sm text-muted">
          Apply <code class="rounded px-1 py-0.5 text-xs">transform: translateZ(0)</code> to the container to create a new stacking context.
        </p>
      </div>
      <div
        id="modal-portal-container"
        class="relative flex h-[380px] items-center justify-center overflow-hidden rounded bg-muted/20"
        // new stacking context
        style={{ transform: "translate(0)" }}
      >
        <PortalProvider container="#modal-portal-container">
          <Modal>
            <Button>Open Modal</Button>
            <Modal.Backdrop class="h-full">
              <Modal.Container class="h-full max-h-full">
                <Modal.Dialog class="h-full max-h-full sm:max-w-md">
                  <Modal.CloseTrigger />
                  <Modal.Header>
                    <Modal.Heading>Custom Portal</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body>
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
                  </Modal.Body>
                  <Modal.Footer>
                    <Button slot="close" variant="secondary">
                      Close
                    </Button>
                  </Modal.Footer>
                </Modal.Dialog>
              </Modal.Container>
            </Modal.Backdrop>
          </Modal>
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
