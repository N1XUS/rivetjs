// Rivet-authored Sheet demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Non Dismissable" };

// #region demo
export function NonDismissable() {
  return (
    <Sheet isDismissable={false}>
      <Button variant="secondary">Accept terms</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Updated terms</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <p class="text-sm text-muted">Please review the changes before you continue.</p>
            </Sheet.Body>
            <Sheet.Footer>
              <Button slot="close" variant="secondary">
                Decline
              </Button>
              <Button slot="close" id="sheet-terms-accept">
                Accept
              </Button>
            </Sheet.Footer>
          </Sheet.Dialog>
        </Sheet.Content>
      </Sheet.Backdrop>
    </Sheet>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <NonDismissable />
    </div>
  );
}
