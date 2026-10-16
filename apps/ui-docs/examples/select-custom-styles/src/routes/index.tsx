// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/select/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Select } from "@rivetjs/ui/select";

export const head = { title: "Select: Tailwind CSS" };

// #region demo
const itemClass = "rounded-lg data-[focused=true]:bg-accent/10 data-[selected=true]:text-foreground";

export function CustomStyles() {
  return (
    <Select class="w-56" placeholder="Pick a plan" variant="secondary">
      <Label class="font-medium text-foreground">Plan</Label>
      <Select.Trigger class="rounded-xl bg-default">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover class="rounded-xl border border-border bg-surface p-1 shadow-lg">
        <ListBox>
          <ListBox.Item class={itemClass} id="free" textValue="Free">
            Free
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item class={itemClass} id="pro" textValue="Pro">
            Pro
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
      <CustomStyles />
    </div>
  );
}
