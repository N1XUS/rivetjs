// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Hold Confirm Sweep" };

// #region demo
export function Sweep() {
  return (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(["right", "left", "down", "up"] as const).map((sweep) => (
        <PressableFeedback class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
          <PressableFeedback.HoldConfirm sweep={sweep} duration={1000} class="bg-accent text-accent-foreground">
            {sweep}
          </PressableFeedback.HoldConfirm>
          Hold ({sweep})
        </PressableFeedback>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Sweep />
    </div>
  );
}
