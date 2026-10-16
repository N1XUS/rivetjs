import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: events" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-5), entry]);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ComboBox
        id="city"
        defaultItems={cities}
        onSelectionChange={(key) => add("selection: " + key)}
        onInputChange={(text) => add("input: " + text)}
        onOpenChange={(open) => add("open: " + open)}
      >
        <Label>City</Label>
        <Group>
          <Input placeholder="Type a city" />
          <Button aria-label="Show cities">
            <Icon icon={ChevronDown} />
          </Button>
        </Group>
        <Popover>
          <ListBox />
        </Popover>
      </ComboBox>
      <output id="log" class="text-slate-600">
        {log().join(" | ")}
      </output>
    </div>
  );
}
// #endregion
