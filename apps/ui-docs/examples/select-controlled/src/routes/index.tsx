// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Controlled" };

// #region demo
export function Controlled() {
  const states = [
    {
      id: "california",
      name: "California",
    },
    {
      id: "texas",
      name: "Texas",
    },
    {
      id: "florida",
      name: "Florida",
    },
    {
      id: "new-york",
      name: "New York",
    },
    {
      id: "illinois",
      name: "Illinois",
    },
    {
      id: "pennsylvania",
      name: "Pennsylvania",
    },
  ];

  const state = signal<Key | null>("california");

  const selectedState = () => states.find((s) => s.id === state());

  return (
    <div class="space-y-2">
      <Select class="w-[256px]" placeholder="Select a state" value={state}>
        <Label>State (controlled)</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {states.map((state) => (
              <ListBox.Item id={state.id} textValue={state.name}>
                {state.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <p class="text-sm text-muted">Selected: {selectedState()?.name || "None"}</p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
