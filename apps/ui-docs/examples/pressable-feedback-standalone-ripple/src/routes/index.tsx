// Rivet-authored PressableFeedback demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Button } from "@rivetjs/ui/button";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "PressableFeedback: Standalone Ripple" };

// #region demo
export function StandaloneRipple() {
  return (
    <div class="flex flex-wrap justify-center gap-3">
      <Button id="pf-standalone-ripple" variant="secondary">
        <PressableFeedback.Ripple />
        Click me
      </Button>
      <Button>
        <PressableFeedback.Ripple pressedOpacity={0.2} />
        Primary
      </Button>
      <Button variant="ghost">
        <PressableFeedback.Ripple duration={300} />
        Slow ripple
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <StandaloneRipple />
    </div>
  );
}
