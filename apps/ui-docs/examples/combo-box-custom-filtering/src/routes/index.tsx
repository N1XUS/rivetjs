// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/custom-filtering.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Custom Filtering" };

// #region demo
export function CustomFiltering() {
  const animals = [
    { id: "cat", name: "Cat" },
    { id: "dog", name: "Dog" },
    { id: "bird", name: "Bird" },
    { id: "fish", name: "Fish" },
    { id: "hamster", name: "Hamster" },
  ];

  return (
    <ComboBox
      class="w-[256px]"
      defaultFilter={(text, inputValue) => {
        if (!inputValue) return true;

        return text.toLowerCase().includes(inputValue.toLowerCase());
      }}
    >
      <Label>Animal (custom filter)</Label>
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
      <CustomFiltering />
    </div>
  );
}
