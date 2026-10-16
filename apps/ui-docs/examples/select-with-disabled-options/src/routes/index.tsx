// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/with-disabled-options.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: With Disabled Options" };

// #region demo
export function WithDisabledOptions() {
  return (
    <Select class="w-[256px]" disabledKeys={["cat", "kangaroo"]} placeholder="Select an animal">
      <Label>Animal</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="dog" textValue="Dog">
            Dog
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="cat" textValue="Cat">
            Cat
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="bird" textValue="Bird">
            Bird
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="kangaroo" textValue="Kangaroo">
            Kangaroo
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="elephant" textValue="Elephant">
            Elephant
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="tiger" textValue="Tiger">
            Tiger
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
      <WithDisabledOptions />
    </div>
  );
}
