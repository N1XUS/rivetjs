// Rivet-authored Sheet demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Snap Points Sequential" };

// #region demo
export function SnapPointsSequential() {
  return (
    <Sheet snapPoints={[0.25, 0.5, 0.75, 1]} snapToSequentialPoint>
      <Button variant="secondary">Open map panel</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Step by step</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <p class="text-sm text-muted">Each flick moves to the neighbouring point.</p>
            </Sheet.Body>
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
      <SnapPointsSequential />
    </div>
  );
}
