// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Standalone Highlight" };

// #region demo
export function Standalone() {
  return (
    <Button variant="secondary" class="relative overflow-hidden">
      <PressableFeedback.Highlight />
      Button with highlight
    </Button>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Standalone />
    </div>
  );
}
