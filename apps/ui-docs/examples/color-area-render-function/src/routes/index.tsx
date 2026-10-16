// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";

export const head = { title: "ColorArea: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <ColorArea defaultValue="rgb(116, 52, 255)" render={(props) => <div {...props} data-custom="slider" />}>
      <ColorArea.Thumb render={(props) => <div {...props} data-custom="thumb" />} />
    </ColorArea>
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
