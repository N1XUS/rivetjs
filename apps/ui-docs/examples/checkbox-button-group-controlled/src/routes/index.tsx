// Rivet-authored CheckboxButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";

export const head = { title: "CheckboxButtonGroup: Controlled" };

// #region demo
export function Controlled() {
  const value = signal<string[]>(["daily"]);
  return (
    <div class="flex w-[30rem] flex-col gap-4">
      <CheckboxButtonGroup class="flex-col" value={value}>
        <Label>Backups</Label>
        <CheckboxButtonGroup.Item value="hourly">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Hourly</Label>
            <Description>Keeps 48 snapshots</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="daily">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Daily</Label>
            <Description>Keeps 30 snapshots</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
        <CheckboxButtonGroup.Item value="weekly">
          <CheckboxButtonGroup.Indicator />
          <CheckboxButtonGroup.ItemContent>
            <Label>Weekly</Label>
            <Description>Keeps 12 snapshots</Description>
          </CheckboxButtonGroup.ItemContent>
        </CheckboxButtonGroup.Item>
      </CheckboxButtonGroup>
      <p class="text-sm text-muted">
        Selected: <span id="value">{value().join(", ") || "none"}</span>
      </p>
      <Button size="sm" variant="secondary" onPress={() => value.set(["hourly", "weekly"])}>
        Pick hourly and weekly
      </Button>
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
