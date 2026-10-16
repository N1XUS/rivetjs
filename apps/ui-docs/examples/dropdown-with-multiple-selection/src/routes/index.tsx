// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-multiple-selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Header } from "@rivetjs/ui/header";
import { Label } from "@rivetjs/ui/label";
import type { Selection } from "@rivetjs/cdk/menu";

export const head = { title: "Dropdown: With Multiple Selection" };

// #region demo
export function WithMultipleSelection() {
  const selected = signal<Selection>(new Set(["apple"]));

  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Preferred Fruits
      </Button>
      <Dropdown.Popover class="min-w-[256px]">
        <Dropdown.Menu selectedKeys={selected} selectionMode="multiple">
          <Dropdown.Section>
            <Header>Select a fruit</Header>
            <Dropdown.Item id="apple" textValue="Apple">
              <Dropdown.ItemIndicator />
              <Label>Apple</Label>
            </Dropdown.Item>
            <Dropdown.Item id="banana" textValue="Banana">
              <Dropdown.ItemIndicator />
              <Label>Banana</Label>
            </Dropdown.Item>
            <Dropdown.Item id="cherry" textValue="Cherry">
              <Dropdown.ItemIndicator />
              <Label>Cherry</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Item id="orange" textValue="Orange">
            <Dropdown.ItemIndicator />
            <Label>Orange</Label>
          </Dropdown.Item>
          <Dropdown.Item id="pear" textValue="Pear">
            <Dropdown.ItemIndicator />
            <Label>Pear</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithMultipleSelection />
    </div>
  );
}
