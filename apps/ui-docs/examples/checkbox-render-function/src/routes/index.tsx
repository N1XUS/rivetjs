// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";

export const head = { title: "Checkbox: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <Checkbox render={(props) => <div {...props} data-custom="bar" />}>
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        Accept terms and conditions
      </Checkbox.Content>
    </Checkbox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
