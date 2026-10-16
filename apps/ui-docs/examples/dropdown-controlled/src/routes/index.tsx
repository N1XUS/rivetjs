// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";
import type { Selection } from "@rivetjs/cdk/menu";

export const head = { title: "Dropdown: Controlled" };

// #region demo
export function Controlled() {
  const selected = signal<Selection>(new Set(["bold"]));

  const selectedItems = () => Array.from(selected());

  return (
    <div class="flex min-w-sm flex-col items-center justify-center gap-4">
      <p class="text-sm text-muted">Selected: {selectedItems().length > 0 ? selectedItems().join(", ") : "None"}</p>
      <Dropdown>
        <Button aria-label="Menu" variant="secondary">
          Actions
        </Button>
        <Dropdown.Menu selectedKeys={selected} selectionMode="multiple">
          <Dropdown.Item id="bold" textValue="Bold">
            <Label>Bold</Label>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
          <Dropdown.Item id="italic" textValue="Italic">
            <Label>Italic</Label>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
          <Dropdown.Item id="underline" textValue="Underline">
            <Label>Underline</Label>
            <Dropdown.ItemIndicator />
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
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
