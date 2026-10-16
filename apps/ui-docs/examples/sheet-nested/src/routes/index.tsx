// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Nested" };

// #region demo
export function Nested() {
  return (
    <Sheet>
      <Button variant="secondary">Open order</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Order #1042</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body>
              <p class="text-sm text-muted">2 items, arriving Thursday.</p>
            </Sheet.Body>
            <Sheet.Footer>
              <Sheet.NestedRoot>
                <Button id="sheet-nested-child">Change address</Button>
                <Sheet.Backdrop variant="transparent">
                  <Sheet.Content>
                    <Sheet.Dialog>
                      <Sheet.Handle />
                      <Sheet.Header>
                        <Sheet.Heading>Delivery address</Sheet.Heading>
                      </Sheet.Header>
                      <Sheet.Body>
                        <p class="text-sm text-muted">14 Harbour Lane, Leith</p>
                      </Sheet.Body>
                      <Sheet.Footer>
                        <Button slot="close">Done</Button>
                      </Sheet.Footer>
                    </Sheet.Dialog>
                  </Sheet.Content>
                </Sheet.Backdrop>
              </Sheet.NestedRoot>
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
      <Nested />
    </div>
  );
}
