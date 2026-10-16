// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <Select class="w-[256px]" placeholder="Select one" variant="primary">
        <Label>Primary variant</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="option1" textValue="Option 1">
              Option 1
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="option2" textValue="Option 2">
              Option 2
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Select class="w-[256px]" placeholder="Select one" variant="secondary">
        <Label>Secondary variant</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="option1" textValue="Option 1">
              Option 1
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="option2" textValue="Option 2">
              Option 2
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
