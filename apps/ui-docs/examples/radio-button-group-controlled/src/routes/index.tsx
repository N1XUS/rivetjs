// Rivet-authored RadioButtonGroup demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";

export const head = { title: "RadioButtonGroup: Controlled" };

// #region demo
export function Controlled() {
  const value = signal<string | null>("daily");
  return (
    <div class="flex w-[30rem] flex-col gap-4">
      <RadioButtonGroup class="flex-col" value={value}>
        <Label>Backups</Label>
        <RadioButtonGroup.Item value="hourly">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Hourly</Label>
            <Description>Keeps 48 snapshots</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="daily">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Daily</Label>
            <Description>Keeps 30 snapshots</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
        <RadioButtonGroup.Item value="weekly">
          <RadioButtonGroup.Indicator />
          <RadioButtonGroup.ItemContent>
            <Label>Weekly</Label>
            <Description>Keeps 12 snapshots</Description>
          </RadioButtonGroup.ItemContent>
        </RadioButtonGroup.Item>
      </RadioButtonGroup>
      <p class="text-sm text-muted">
        Selected: <span id="value">{value() ?? "none"}</span>
      </p>
      <Button size="sm" variant="secondary" onPress={() => value.set("weekly")}>
        Pick weekly
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
