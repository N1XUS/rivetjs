import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ComboBox, type Key } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: controlled" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Controlled() {
  const city = signal<Key | null>("lis");
  const text = signal("Lisbon");
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ComboBox
        id="city"
        defaultItems={cities}
        selectedKey={city}
        inputValue={text}
        // Both controlled: the app writes the input text when the selection changes.
        onSelectionChange={(key) => text.set(cities.find((c) => c.id === key)?.name ?? "")}
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
      <p id="value">
        Key: {city() ?? "none"} · Text: {text()}
      </p>
      <div class="flex gap-2">
        <button
          id="pick-zur"
          type="button"
          class="rounded border px-2 py-1"
          onClick={() => {
            city.set("zur");
            text.set("Zürich");
          }}
        >
          Pick Zürich
        </button>
        <button
          id="clear"
          type="button"
          class="rounded border px-2 py-1"
          onClick={() => {
            city.set(null);
            text.set("");
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
// #endregion
