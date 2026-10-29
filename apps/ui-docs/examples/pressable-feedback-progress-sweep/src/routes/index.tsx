// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Progress Feedback Sweep" };

// #region demo
export function ProgressSweep() {
  return (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(["right", "left", "down", "up"] as const).map((sweep) => (
        <PressableFeedback id={`pf-progress-sweep-${sweep}`} class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
          <PressableFeedback.ProgressFeedback sweep={sweep} duration={1000} class="bg-success text-success-foreground">
            {sweep}
          </PressableFeedback.ProgressFeedback>
          Press ({sweep})
        </PressableFeedback>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ProgressSweep />
    </div>
  );
}
