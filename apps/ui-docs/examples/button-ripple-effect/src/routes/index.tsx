// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/ripple-effect.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Adding Ripple Effect" };

// #region demo
// Not yet ported: upstream nests `<Ripple />` from m3-ripple (a React component + its CSS) inside the button.
// There is no Rivet ripple component, so the button renders without the ripple.
export function RippleEffect() {
  return <Button variant="secondary">Click me</Button>;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RippleEffect />
    </div>
  );
}
