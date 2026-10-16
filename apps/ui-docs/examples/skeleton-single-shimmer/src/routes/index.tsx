// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/single-shimmer.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: Single Shimmer" };

// #region demo
export function SingleShimmer() {
  return (
    <div class="skeleton--shimmer relative grid w-full max-w-xl grid-cols-3 gap-4 overflow-hidden rounded-xl">
      <Skeleton animationType="none" class="h-24 rounded-xl" />
      <Skeleton animationType="none" class="h-24 rounded-xl" />
      <Skeleton animationType="none" class="h-24 rounded-xl" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SingleShimmer />
    </div>
  );
}
