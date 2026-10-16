import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup content and descriptions" };

const speeds = [
  { value: "std", label: "Standard", id: "speed-std", description: "3 to 5 working days.", price: "free" },
  { value: "fast", label: "Express", id: "speed-fast", description: "Next working day.", price: "€9" },
];

// #region demo
export default function Delivery() {
  return (
    <RadioGroup id="speeds" class="m-4 grid max-w-md gap-2 text-sm" label="Delivery" description="Prices include VAT." items={speeds} defaultValue="std">
      {(item) => (
        <span class="inline-flex w-48 justify-between font-medium">
          {item().label}
          <span class="text-slate-500">{speeds.find((s) => s.value === item().value)!.price}</span>
        </span>
      )}
    </RadioGroup>
  );
}
// #endregion
