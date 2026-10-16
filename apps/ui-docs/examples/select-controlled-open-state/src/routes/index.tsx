// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/controlled-open-state.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Controlled Open State" };

// #region demo
export function ControlledOpenState() {
  const isOpen = signal(false);

  return (
    <div class="space-y-4">
      <Select class="w-[256px]" isOpen={isOpen} placeholder="Select one">
        <Label>State</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="delaware" textValue="Delaware">
              Delaware
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
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="washington" textValue="Washington">
              Washington
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <Button onPress={() => isOpen.set(!isOpen())}>{isOpen() ? "Close" : "Open"} Select</Button>
      <p class="text-sm text-muted">Select is {isOpen() ? "open" : "closed"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ControlledOpenState />
    </div>
  );
}
