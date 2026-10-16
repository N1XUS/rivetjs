// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Snap Points Custom Fade" };

// #region demo
export function SnapPointsCustomFade() {
  return (
    <Sheet snapPoints={[0.25, 0.5, 1]} fadeFromIndex={1}>
      <Button variant="secondary">Open map panel</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Route options</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <p class="text-sm text-muted">The page stays visible behind the peek; the backdrop darkens from the middle point.</p>
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
      <SnapPointsCustomFade />
    </div>
  );
}
