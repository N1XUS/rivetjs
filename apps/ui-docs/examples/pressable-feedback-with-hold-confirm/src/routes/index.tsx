// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { Lock, LockOpen } from "lucide";

export const head = { title: "PressableFeedback: With Hold Confirm" };

// #region demo
export function WithHoldConfirm() {
  const unlocked = signal(false);
  return (
    <div class="flex flex-col items-center gap-3">
      <PressableFeedback
        id="pf-with-hold"
        class="flex w-64 items-center justify-center gap-2 rounded-full bg-default px-6 py-3 text-sm font-medium text-foreground"
      >
        <PressableFeedback.Highlight />
        <PressableFeedback.Ripple />
        <PressableFeedback.HoldConfirm
          duration={800}
          resetOnComplete={false}
          class="gap-2 bg-success text-success-foreground"
          onComplete={() => unlocked.set(true)}
        >
          <Icon icon={LockOpen} size={16} />
          Unlocked
        </PressableFeedback.HoldConfirm>
        <Icon icon={Lock} size={16} />
        Hold to unlock
      </PressableFeedback>
      <p id="pf-with-hold-status" class="text-sm text-muted">
        {unlocked() ? "Door unlocked" : "Door locked"}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithHoldConfirm />
    </div>
  );
}
