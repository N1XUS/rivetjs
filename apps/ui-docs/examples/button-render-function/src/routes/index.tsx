// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: Render Function" };

// #region demo
export function RenderFunction() {
  return <Button render={(props, { isPressed }) => <button {...props} data-custom={isPressed() ? "pressed" : "bar"} />}>Press me</Button>;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
