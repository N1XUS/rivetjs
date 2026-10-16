// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/controlled-input-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Controlled Input Value" };

// #region demo
export function ControlledInputValue() {
  const inputValue = signal("");

  return (
    <div class="space-y-2">
      <ComboBox class="w-[256px]" inputValue={inputValue}>
        <Label>Search (controlled input)</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Type to search..." />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            <ListBox.Item id="aardvark" textValue="Aardvark">
              Aardvark
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="cat" textValue="Cat">
              Cat
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="kangaroo" textValue="Kangaroo">
              Kangaroo
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="panda" textValue="Panda">
              Panda
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="snake" textValue="Snake">
              Snake
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <p class="text-sm text-muted">Input value: {inputValue() || "(empty)"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ControlledInputValue />
    </div>
  );
}
