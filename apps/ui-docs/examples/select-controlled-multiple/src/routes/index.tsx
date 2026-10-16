// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/controlled-multiple.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Controlled Multiple" };

// #region demo
export function ControlledMultiple() {
  const selected = signal<readonly Key[]>(["california", "texas"]);

  return (
    <div class="space-y-4">
      <Select class="w-[256px]" placeholder="Select states" selectionMode="multiple" value={selected}>
        <Label>States (controlled multiple)</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox selectionMode="multiple">
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="new-york" textValue="New York">
              New York
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="illinois" textValue="Illinois">
              Illinois
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="pennsylvania" textValue="Pennsylvania">
              Pennsylvania
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <p class="text-sm text-muted">Selected: {selected().length > 0 ? selected().join(", ") : "None"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ControlledMultiple />
    </div>
  );
}
