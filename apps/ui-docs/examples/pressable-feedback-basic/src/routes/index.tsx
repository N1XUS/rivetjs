// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Usage" };

// #region demo
export function Basic() {
  return (
    <PressableFeedback id="pf-basic" class="rounded-xl bg-default px-5 py-2.5 text-sm font-medium text-foreground">
      <PressableFeedback.Highlight />
      <PressableFeedback.Ripple />
      Press me
    </PressableFeedback>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Basic />
    </div>
  );
}
