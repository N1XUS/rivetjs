// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/placements.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Placements" };

// #region demo
export function Placements() {
  const placements = ["auto", "top", "center", "bottom"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {placements.map((placement) => (
        <AlertDialog>
          <Button variant="secondary">{placement.charAt(0).toUpperCase() + placement.slice(1)}</Button>
          <AlertDialog.Backdrop>
            <AlertDialog.Container placement={placement}>
              <AlertDialog.Dialog class="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="accent" />
                  <AlertDialog.Heading>
                    {placement === "auto" ? "Auto Placement" : `${placement.charAt(0).toUpperCase() + placement.slice(1)} Position`}
                  </AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {placement === "auto"
                      ? "Automatically positions at the bottom on mobile and center on desktop for optimal user experience."
                      : `This dialog is positioned at the ${placement} of the viewport. Critical confirmations are typically centered for maximum attention.`}
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
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placements />
    </div>
  );
}
