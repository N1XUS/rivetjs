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

export const head = { title: "ComboBox: DOM events" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-5), entry]);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ComboBox id="city" defaultItems={cities} onDblClick={() => add("root dblclick")} onKeyDown={(e) => add("keydown " + e.key)}>
        <Label>City</Label>
        <Group>
          <Input onPaste={() => add("paste")} onInput={() => add("input")} />
          <Button aria-label="Show cities">
            <Icon icon={ChevronDown} />
          </Button>
        </Group>
        <Popover>
          <ListBox onContextMenu={() => add("list contextmenu")} />
        </Popover>
      </ComboBox>
      <p id="log" class="text-slate-600">
        {log().join(", ")}
      </p>
    </div>
  );
}
// #endregion
