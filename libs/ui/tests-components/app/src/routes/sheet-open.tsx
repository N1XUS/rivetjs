// Sheet open in the server HTML (`defaultOpen`, snap points 0.5 / 1): `#sho-dialog` with `#sho-handle`; drag must work on the
// resumed page before any other interaction (client effect attached at load).
import { Sheet } from "@rivetjs/ui/sheet";

export default function SheetOpenStories() {
  return (
    <section class="p-10">
      <Sheet defaultOpen snapPoints={[0.5, 1]}>
        <Sheet.Trigger id="sho-trigger">Open sheet</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sho-dialog" aria-label="Open on load">
              <Sheet.Handle id="sho-handle" />
              <Sheet.Body>Body</Sheet.Body>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </section>
  );
}
