// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { Check, CreditCard } from "lucide";

export const head = { title: "PressableFeedback: With Progress Feedback" };

// #region demo
export function WithProgress() {
  const status = signal("Ready to pay");
  return (
    <div class="flex flex-col items-center gap-3">
      <PressableFeedback
        id="pf-with-progress"
        class="flex w-64 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground"
      >
        <PressableFeedback.Highlight />
        <PressableFeedback.ProgressFeedback
          duration={1000}
          resetDelay={1200}
          class="gap-2 bg-success text-success-foreground"
          onComplete={() => status.set("Payment sent")}
          onReset={() => status.set("Ready to pay")}
        >
          <Icon icon={Check} size={16} />
          Paid
        </PressableFeedback.ProgressFeedback>
        <Icon icon={CreditCard} size={16} />
        Pay $24.00
      </PressableFeedback>
      <p id="pf-with-progress-status" class="text-sm text-muted">
        {status()}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithProgress />
    </div>
  );
}
