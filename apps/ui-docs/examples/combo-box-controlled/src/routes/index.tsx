// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import type { Key } from "@rivetjs/cdk/combobox";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Controlled" };

// #region demo
export function Controlled() {
  const animals = [
    {
      id: "cat",
      name: "Cat",
    },
    {
      id: "dog",
      name: "Dog",
    },
    {
      id: "bird",
      name: "Bird",
    },
    {
      id: "fish",
      name: "Fish",
    },
    {
      id: "hamster",
      name: "Hamster",
    },
  ];

  const selectedKey = signal<Key | null>("cat");

  const selectedAnimal = () => animals.find((a) => a.id === selectedKey());

  return (
    <div class="space-y-2">
      <ComboBox class="w-[256px]" selectedKey={selectedKey}>
        <Label>Animal (controlled)</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Search animals..." />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            {animals.map((animal) => (
              <ListBox.Item id={animal.id} textValue={animal.name}>
                {animal.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <p class="text-sm text-muted">Selected: {selectedAnimal()?.name || "None"}</p>
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
