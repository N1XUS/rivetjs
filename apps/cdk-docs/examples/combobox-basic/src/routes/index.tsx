import { signal } from "@rivetjs/reactivity";
import { Announcer } from "@rivetjs/cdk/announcer";
import { Button } from "@rivetjs/cdk/button";
import { ComboBox, type Key } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Trip() {
  const city = signal<Key | null>(null);
  return (
    <form class="m-4 grid max-w-sm gap-3 text-sm" method="get">
      <ComboBox id="city" defaultItems={cities} name="city" selectedKey={city}>
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
      <p id="value" class="text-slate-600">
        Selected: {city() ?? "none"}
      </p>
      {/* Live regions for the result count (usually in the root layout). */}
      <Announcer />
    </form>
  );
}
// #endregion
