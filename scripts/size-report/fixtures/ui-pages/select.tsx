// ui page-CSS fixture: Select (Label + Select + ListBox).
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export default function Page() {
  return (
    <main>
      <Select placeholder="Select one">
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="fl" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="tx" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </main>
  );
}
