// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Progress Feedback No Reset" };

// #region demo
export function NoReset() {
  return (
    <PressableFeedback id="pf-noreset" class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
      <PressableFeedback.ProgressFeedback autoReset={false} duration={600} class="bg-success text-success-foreground">
        Published
      </PressableFeedback.ProgressFeedback>
      Publish
    </PressableFeedback>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <NoReset />
    </div>
  );
}
