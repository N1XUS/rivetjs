// UI-COLD: one ui Select alone on a resumed page (cold-path bench `cold-latency.ts --app ui --targets select` + select-cold.test.ts):
// trigger `#sc-trigger`, three options, `onChange` key echoed in `#sc-value`.
import { signal } from "@rivetjs/reactivity";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export default function SelectCold() {
  const value = signal("california");
  return (
    <section class="flex flex-col gap-8 p-10">
      <Select data-testid="sc" class="w-[256px]" defaultValue="california" onChange={(key) => value.set(String(key))}>
        <Label>State</Label>
        <Select.Trigger id="sc-trigger">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <output id="sc-value">{value()}</output>
    </section>
  );
}
