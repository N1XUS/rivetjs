// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "Input: In Surface" };

// #region demo
export function OnSurface() {
  return (
    <Surface class="flex h-[180px] w-[280px] items-center justify-center rounded-3xl bg-surface p-4">
      <Input class="w-full" placeholder="Your name" variant="secondary" />
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
