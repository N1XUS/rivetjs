// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Controlled" };

// #region demo
export function Controlled() {
  const isOpen = signal(false);
  return (
    <div class="flex flex-col items-center gap-3">
      <Button id="sheet-controlled-open" onPress={() => isOpen.set(true)}>
        Open from outside
      </Button>
      <p class="text-sm text-muted">
        Sheet is <span id="sheet-controlled-state">{isOpen() ? "open" : "closed"}</span>
      </p>
      <Sheet isOpen={isOpen}>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Handle />
              <Sheet.Header>
                <Sheet.Heading>Controlled sheet</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body>
                <p class="text-sm text-muted">Closing by drag, Escape or the backdrop writes `false` back into the signal.</p>
              </Sheet.Body>
              <Sheet.Footer>
                <Button variant="secondary" onPress={() => isOpen.set(false)}>
                  Close
                </Button>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
