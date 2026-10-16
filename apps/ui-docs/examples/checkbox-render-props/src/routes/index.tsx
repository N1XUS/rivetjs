// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/render-props.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { Description } from "@rivetjs/ui/description";

export const head = { title: "Checkbox: Render Props" };

// #region demo
export function RenderProps() {
  return (
    <Checkbox id="render-props-terms">
      {({ isSelected }) => (
        <>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            {isSelected() ? "Terms accepted" : "Accept terms"}
          </Checkbox.Content>
          <Description>{isSelected() ? "Thank you for accepting" : "Please read and accept the terms"}</Description>
        </>
      )}
    </Checkbox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderProps />
    </div>
  );
}
