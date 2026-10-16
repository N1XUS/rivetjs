// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/grid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: Grid" };

// #region demo
export function Grid() {
  return (
    <div class="grid w-full max-w-xl grid-cols-3 gap-4">
      <Skeleton class="h-24 rounded-xl" />
      <Skeleton class="h-24 rounded-xl" />
      <Skeleton class="h-24 rounded-xl" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Grid />
    </div>
  );
}
