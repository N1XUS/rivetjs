// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/ripple-effect.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: upstream nests `<Ripple />` from m3-ripple; here `PressableFeedback.Ripple` (standalone: it follows its parent
// Button's press — pointer at the press point, Space / Enter centred).
import { Button } from "@rivetjs/ui/button";
import { PressableFeedback } from "@rivetjs/ui/pressable-feedback";

export const head = { title: "Button: Adding Ripple Effect" };

// #region demo
export function RippleEffect() {
  return (
    <Button variant="secondary">
      <PressableFeedback.Ripple />
      Click me
    </Button>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RippleEffect />
    </div>
  );
}
