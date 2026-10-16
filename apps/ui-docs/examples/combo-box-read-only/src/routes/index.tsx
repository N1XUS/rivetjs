// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/read-only.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Read Only" };

// #region demo
const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "panda", name: "Panda" },
  { id: "snake", name: "Snake" },
];

export function ReadOnly() {
  return (
    <ComboBox isReadOnly class="w-[256px]" defaultSelectedKey="cat">
      <Label>Favorite Animal</Label>
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ReadOnly />
    </div>
  );
}
