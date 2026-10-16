// Rivet-authored NumberStepper demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Star } from "lucide";
import { NumberStepper } from "@rivetjs/ui/number-stepper";

export const head = { title: "NumberStepper: Custom Value" };

// #region demo
export function CustomValue() {
  return (
    <div class="flex flex-col items-center gap-4">
      <NumberStepper aria-label="Nights" defaultValue={3} minValue={1} maxValue={30}>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value format={(nights) => `${nights} ${nights === 1 ? "night" : "nights"}`} />
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
      <NumberStepper aria-label="Rating" defaultValue={4} minValue={0} maxValue={5}>
        <NumberStepper.Group>
          <NumberStepper.DecrementButton />
          <NumberStepper.Value wrapperClass="w-24">
            {({ value }) => (
              <span class="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon icon={Star} class={(value() ?? 0) >= n ? "size-4 fill-warning text-warning" : "size-4 text-muted"} />
                ))}
              </span>
            )}
          </NumberStepper.Value>
          <NumberStepper.IncrementButton />
        </NumberStepper.Group>
      </NumberStepper>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValue />
    </div>
  );
}
