// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-area/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ColorArea } from "@rivetjs/ui/color-area";

export const head = { title: "ColorArea: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <ColorArea class="size-44 rounded-3xl" defaultValue="rgb(116, 52, 255)">
      <ColorArea.Thumb class="size-5 rounded-full border-4 border-white" />
    </ColorArea>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
