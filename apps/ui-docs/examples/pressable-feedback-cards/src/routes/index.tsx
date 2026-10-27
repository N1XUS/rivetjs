// Rivet-authored PressableFeedback demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";
import { CreditCard, Landmark, Wallet } from "lucide";

export const head = { title: "PressableFeedback: Pressable Cards" };

// #region demo
const METHODS = [
  { title: "Card", text: "Visa ending 4242", icon: CreditCard },
  { title: "Bank transfer", text: "2–3 business days", icon: Landmark },
  { title: "Wallet", text: "Balance $120.00", icon: Wallet },
];

export function Cards() {
  return (
    <div class="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      {METHODS.map((m) => (
        <PressableFeedback class="flex flex-col items-start gap-2 rounded-2xl bg-surface p-4 text-start shadow-surface">
          <PressableFeedback.Highlight />
          <PressableFeedback.Ripple />
          <Icon icon={m.icon} size={20} class="text-muted" />
          <span class="text-sm font-medium">{m.title}</span>
          <span class="text-xs text-muted">{m.text}</span>
        </PressableFeedback>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Cards />
    </div>
  );
}
