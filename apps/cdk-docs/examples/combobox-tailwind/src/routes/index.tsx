import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: Tailwind" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Tailwind() {
  return (
    <div class="m-4 max-w-sm text-sm">
      <ComboBox id="city" defaultItems={cities} class="group grid gap-1">
        <Label class="font-medium text-slate-700 group-data-[open]:text-teal-700">City</Label>
        <Group class="flex rounded-md border border-slate-300 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30">
          <Input class="min-w-0 flex-1 rounded-md px-3 py-2 outline-none" />
          <Button aria-label="Show cities" class="px-2 text-slate-500 data-[pressed]:text-teal-700">
            <Icon icon={ChevronDown} />
          </Button>
        </Group>
        <Popover class="w-(--trigger-width) rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          <ListBox class="outline-none">
            {(city: (typeof cities)[number]) => (
              <ListBoxItem
                id={city.id}
                class="cursor-default rounded px-3 py-1.5 outline-none focused:bg-teal-600 focused:text-white aria-selected:font-semibold"
              >
                {city.name}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </div>
  );
}
// #endregion
