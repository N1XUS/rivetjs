// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";

export const head = { title: "ColorArea: Disabled" };

// #region demo
export function ColorAreaDisabled() {
  return (
    <ColorArea isDisabled defaultValue="hsl(200, 100%, 50%)">
      <ColorArea.Thumb />
    </ColorArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColorAreaDisabled />
    </div>
  );
}
