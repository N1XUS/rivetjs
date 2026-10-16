// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Detached" };

// #region demo
export function Detached() {
  return (
    <Sheet isDetached>
      <Button variant="secondary">Open detached sheet</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Now playing</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <p class="text-sm text-muted">A detached sheet keeps a gap to the screen edge, like a floating card.</p>
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
      <Detached />
    </div>
  );
}
