import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: CSS" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Css() {
  return (
    <div class="demo">
      <ComboBox id="city" defaultItems={cities}>
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
