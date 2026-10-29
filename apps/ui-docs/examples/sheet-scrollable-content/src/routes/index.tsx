// Rivet-authored Sheet demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Scrollable Content" };

// #region demo
const SECTIONS = Array.from({ length: 12 }, (_, i) => ({
  title: `Section ${i + 1}`,
  text: "Payments are processed within two business days. Refunds go back to the original payment method.",
}));

export function ScrollableContent() {
  return (
    <Sheet>
      <Button variant="secondary">Read the policy</Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Refund policy</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body class="max-h-72 overflow-y-auto">
              {SECTIONS.map((section) => (
                <section class="py-2">
                  <h3 class="text-sm font-medium">{section.title}</h3>
                  <p class="text-sm text-muted">{section.text}</p>
                </section>
              ))}
            </Sheet.Body>
            <Sheet.Footer>
              <Button slot="close">Got it</Button>
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
      <ScrollableContent />
    </div>
  );
}
