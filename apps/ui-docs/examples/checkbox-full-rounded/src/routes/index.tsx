// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/full-rounded.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Checkbox: Full Rounded" };

// #region demo
export function FullRounded() {
  return (
    <div class="flex flex-col gap-6">
      <div class="flex flex-col gap-3">
        <Label class="text-muted">Rounded checkboxes</Label>
        <Checkbox class="[&_[data-slot='checkbox-default-indicator--checkmark']]:size-2" name="small-rounded">
          <Checkbox.Content>
            <Checkbox.Control class="size-3 rounded-full before:rounded-full">
              <Checkbox.Indicator />
            </Checkbox.Control>
            Small size
          </Checkbox.Content>
        </Checkbox>
      </div>
      <div class="flex flex-col gap-3">
        <Checkbox name="default-rounded">
          <Checkbox.Content>
            <Checkbox.Control class="size-4 rounded-full before:rounded-full">
              <Checkbox.Indicator />
            </Checkbox.Control>
            Default size
          </Checkbox.Content>
        </Checkbox>
      </div>
      <div class="flex flex-col gap-3">
        <Checkbox name="large-rounded">
          <Checkbox.Content>
            <Checkbox.Control class="size-5 rounded-full before:rounded-full">
              <Checkbox.Indicator />
            </Checkbox.Control>
            Large size
          </Checkbox.Content>
        </Checkbox>
      </div>
      <div class="flex flex-col gap-3">
        <Checkbox class="[&_[data-slot='checkbox-default-indicator--checkmark']]:size-4" name="xl-rounded">
          <Checkbox.Content>
            <Checkbox.Control class="size-6 rounded-full before:rounded-full">
              <Checkbox.Indicator />
            </Checkbox.Control>
            Extra large size
          </Checkbox.Content>
        </Checkbox>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullRounded />
    </div>
  );
}
