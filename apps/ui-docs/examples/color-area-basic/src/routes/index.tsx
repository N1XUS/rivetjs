// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";

export const head = { title: "ColorArea: Usage" };

// #region demo
export function ColorAreaBasic() {
  return (
    <ColorArea defaultValue="rgb(116, 52, 255)">
      <ColorArea.Thumb />
    </ColorArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorAreaBasic />
    </div>
  );
}
