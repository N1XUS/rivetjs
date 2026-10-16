// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textarea/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Surface } from "@rivetjs/ui/surface";
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "TextArea: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="w-full rounded-3xl p-6">
      <TextArea class="w-full min-w-[280px]" placeholder="Describe your product" variant="secondary" />
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
