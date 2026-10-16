// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Snap Points" };

// #region demo
export function SnapPoints() {
  const point = signal<number | string | null>(0.4);
  return (
    <div class="flex flex-col items-center gap-3">
      <Sheet snapPoints={[0.4, 1]} activeSnapPoint={point}>
        <Button variant="secondary">Open map panel</Button>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Handle />
              <Sheet.Header>
                <Sheet.Heading>Nearby places</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body>
                <p class="text-sm text-muted">Drag up for the full list; press the handle to cycle the points.</p>
              </Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <p class="text-sm text-muted">
        Snap point: <span id="sheet-snap-point">{String(point())}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SnapPoints />
    </div>
  );
}
