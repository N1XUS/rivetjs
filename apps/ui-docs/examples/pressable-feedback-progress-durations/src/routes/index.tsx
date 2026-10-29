// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Progress Feedback Durations" };

// #region demo
export function ProgressDurations() {
  const options = [
    { id: "pf-progress-500", label: "Fast", duration: 500, releaseDuration: 150 },
    { id: "pf-progress-1500", label: "Normal", duration: 1500, releaseDuration: 300 },
    { id: "pf-progress-3000", label: "Slow", duration: 3000, releaseDuration: 600 },
  ];
  return (
    <div class="flex flex-wrap justify-center gap-3">
      {options.map((option) => (
        <PressableFeedback id={option.id} class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
          <PressableFeedback.ProgressFeedback
            duration={option.duration}
            releaseDuration={option.releaseDuration}
            resetDelay={1000}
            class="bg-accent text-accent-foreground"
          >
            Done
          </PressableFeedback.ProgressFeedback>
          {option.label} ({option.duration / 1000} s)
        </PressableFeedback>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ProgressDurations />
    </div>
  );
}
