// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Comparison" };

// #region demo
export function Comparison() {
  return (
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <PressableFeedback class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
        <PressableFeedback.Highlight />
        Highlight
      </PressableFeedback>
      <PressableFeedback class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
        <PressableFeedback.Ripple />
        Ripple
      </PressableFeedback>
      <PressableFeedback class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
        <PressableFeedback.HoldConfirm class="bg-accent text-accent-foreground">Confirmed</PressableFeedback.HoldConfirm>
        Hold
      </PressableFeedback>
      <PressableFeedback class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
        <PressableFeedback.ProgressFeedback class="bg-accent text-accent-foreground">Done</PressableFeedback.ProgressFeedback>
        Progress
      </PressableFeedback>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Comparison />
    </div>
  );
}
