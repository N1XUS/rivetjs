// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { Trash2 } from "lucide";

export const head = { title: "PressableFeedback: Hold Confirm" };

// #region demo
export function HoldConfirm() {
  const deleted = signal(0);
  return (
    <div class="flex flex-col items-center gap-3">
      <PressableFeedback id="pf-hold" class="flex items-center gap-2 rounded-xl bg-danger-soft px-5 py-2.5 text-sm font-medium text-danger">
        <PressableFeedback.HoldConfirm
          duration={1200}
          releaseDuration={250}
          class="gap-2 bg-danger text-danger-foreground"
          onComplete={() => deleted.set(deleted() + 1)}
        >
          <Icon icon={Trash2} size={16} />
          Deleted
        </PressableFeedback.HoldConfirm>
        <Icon icon={Trash2} size={16} />
        Hold to delete
      </PressableFeedback>
      <p id="pf-hold-count" class="text-sm text-muted">
        Deleted {deleted()} times
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <HoldConfirm />
    </div>
  );
}
