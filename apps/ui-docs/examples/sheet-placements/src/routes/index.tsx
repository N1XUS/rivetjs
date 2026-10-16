// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Placements" };

// #region demo
const PLACEMENTS = ["top", "right", "bottom", "left"] as const;

export function Placements() {
  return (
    <div class="flex flex-wrap gap-3">
      {PLACEMENTS.map((placement) => (
        <Sheet placement={placement}>
          <Button variant="secondary" class="capitalize">
            {placement}
          </Button>
          <Sheet.Backdrop>
            <Sheet.Content>
              <Sheet.Dialog>
                <Sheet.Handle />
                <Sheet.Header>
                  <Sheet.Heading class="capitalize">{placement} sheet</Sheet.Heading>
                </Sheet.Header>
                <Sheet.Body>
                  <p class="text-sm text-muted">Drag towards the {placement} edge to close.</p>
                </Sheet.Body>
              </Sheet.Dialog>
            </Sheet.Content>
          </Sheet.Backdrop>
        </Sheet>
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
