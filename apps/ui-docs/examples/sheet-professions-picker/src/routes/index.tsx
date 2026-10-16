// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "Sheet: Professions Picker" };

// #region demo
const ROLES = ["Architect", "Baker", "Carpenter", "Designer", "Editor", "Florist", "Gardener", "Nurse", "Pilot", "Teacher"];

export function ProfessionsPicker() {
  const selected = signal<Selection>(new Set(["Designer"]));
  const label = () => {
    const keys = selected();
    return keys === "all" ? "All" : (([...keys][0] as string | undefined) ?? "Choose");
  };
  return (
    <Sheet>
      <Button variant="secondary" id="sheet-profession-trigger">
        Profession: {label()}
      </Button>
      <Sheet.Backdrop>
        <Sheet.Content>
          <Sheet.Dialog>
            <Sheet.Handle />
            <Sheet.Header>
              <Sheet.Heading>Your profession</Sheet.Heading>
            </Sheet.Header>
            <Sheet.Body class="max-h-64 overflow-y-auto">
              <ListBox aria-label="Professions" selectionMode="single" selectedKeys={selected}>
                {ROLES.map((role) => (
                  <ListBox.Item id={role} textValue={role}>
                    {role}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Sheet.Body>
            <Sheet.Footer>
              <Button slot="close">Done</Button>
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
      <ProfessionsPicker />
    </div>
  );
}
