// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Hold Confirm Durations" };

// #region demo
export function HoldConfirmDurations() {
  const last = signal("Nothing confirmed yet");
  const options = [
    { id: "pf-hold-500", label: "Quick", duration: 500, releaseDuration: 150 },
    { id: "pf-hold-1500", label: "Normal", duration: 1500, releaseDuration: 300 },
    { id: "pf-hold-3000", label: "Careful", duration: 3000, releaseDuration: 600 },
  ];
  return (
    <div class="flex flex-col items-center gap-4">
      <div class="flex flex-wrap justify-center gap-3">
        {options.map((option) => (
          <PressableFeedback id={option.id} class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
            <PressableFeedback.HoldConfirm
              duration={option.duration}
              releaseDuration={option.releaseDuration}
              class="bg-accent text-accent-foreground"
              onComplete={() => last.set(`Confirmed: ${option.label}`)}
            >
              Confirmed
            </PressableFeedback.HoldConfirm>
            {option.label} ({option.duration / 1000} s)
          </PressableFeedback>
        ))}
      </div>
      <p id="pf-hold-durations-status" class="text-sm text-muted">
        {last()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <HoldConfirmDurations />
    </div>
  );
}
