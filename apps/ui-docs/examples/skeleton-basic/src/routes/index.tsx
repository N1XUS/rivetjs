// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="shadow-panel w-[250px] space-y-5 rounded-lg bg-transparent p-4">
      <Skeleton class="h-32 rounded-lg" />
      <div class="space-y-3">
        <Skeleton class="h-3 w-3/5 rounded-lg" />
        <Skeleton class="h-3 w-4/5 rounded-lg" />
        <Skeleton class="h-3 w-2/5 rounded-lg" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
