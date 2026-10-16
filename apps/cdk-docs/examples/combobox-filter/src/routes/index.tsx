import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: filter" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Filter() {
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ComboBox id="city" defaultItems={cities} menuTrigger="focus" defaultFilter={(textValue, inputValue) => textValue.toLowerCase().startsWith(inputValue.toLowerCase())}>
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
    </div>
  );
}
// #endregion
