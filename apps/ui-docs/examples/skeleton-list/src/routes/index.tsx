// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/list.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: List Items" };

// #region demo
export function List() {
  return (
    <div class="w-full max-w-sm space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div class="flex items-center gap-3">
          <Skeleton class="h-10 w-10 shrink-0 rounded-lg" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-3 w-full rounded" />
            <Skeleton class="h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <List />
    </div>
  );
}
