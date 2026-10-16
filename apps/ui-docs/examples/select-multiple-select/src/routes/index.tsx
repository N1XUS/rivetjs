// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/multiple-select.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Multiple Select" };

// #region demo
export function MultipleSelect() {
  return (
    <Select class="w-[256px]" placeholder="Select countries" selectionMode="multiple">
      <Label>Countries to Visit</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox selectionMode="multiple">
          <ListBox.Item id="argentina" textValue="Argentina">
            Argentina
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="venezuela" textValue="Venezuela">
            Venezuela
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="japan" textValue="Japan">
            Japan
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="france" textValue="France">
            France
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="italy" textValue="Italy">
            Italy
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="spain" textValue="Spain">
            Spain
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="thailand" textValue="Thailand">
            Thailand
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="new-zealand" textValue="New Zealand">
            New Zealand
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="iceland" textValue="Iceland">
            Iceland
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <MultipleSelect />
    </div>
  );
}
