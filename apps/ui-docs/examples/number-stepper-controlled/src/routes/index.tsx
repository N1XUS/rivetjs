// Rivet-authored NumberStepper demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Controlled" };

// #region demo
export function Controlled() {
  const seats = signal<number | null>(4);
  return (
    <div class="flex flex-col items-center gap-3">
      <NumberStepper aria-label="Seats" value={seats} minValue={1} maxValue={50}>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
      <p class="text-sm text-muted">
        Seats: <span id="seats">{seats()}</span>
      </p>
      <Button size="sm" variant="secondary" onPress={() => seats.set(25)}>
        Set to 25
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
