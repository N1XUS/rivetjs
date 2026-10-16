// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Guest Picker" };

// #region demo
export function GuestPicker() {
  const rows = [
    { label: "Adults", hint: "Ages 13 or above", value: 2, min: 1 },
    { label: "Children", hint: "Ages 2 to 12", value: 1, min: 0 },
    { label: "Infants", hint: "Under 2", value: 0, min: 0 },
    { label: "Pets", hint: "Service animals welcome", value: 0, min: 0 },
  ];
  return (
    <div class="flex w-80 flex-col divide-y divide-separator rounded-2xl bg-surface px-4 shadow-surface">
      {rows.map((row) => (
        <NumberStepper class="flex-row items-center justify-between py-3" defaultValue={row.value} minValue={row.min} maxValue={8} size="sm">
          <div class="flex flex-col">
            <Label>{row.label}</Label>
            <Description>{row.hint}</Description>
          </div>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <GuestPicker />
    </div>
  );
}
