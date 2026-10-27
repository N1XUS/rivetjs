// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Progress Feedback" };

// #region demo
export function Progress() {
  const status = signal("Idle");
  return (
    <div class="flex flex-col items-center gap-3">
      <PressableFeedback id="pf-progress" class="rounded-xl bg-accent-soft px-5 py-2.5 text-sm font-medium text-accent">
        <PressableFeedback.ProgressFeedback
          duration={800}
          resetDelay={800}
          class="bg-accent text-accent-foreground"
          onComplete={() => status.set("Sent")}
          onReset={() => status.set("Idle")}
        >
          Sent
        </PressableFeedback.ProgressFeedback>
        Send invite
      </PressableFeedback>
      <p id="pf-progress-status" class="text-sm text-muted">
        {status()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Progress />
    </div>
  );
}
