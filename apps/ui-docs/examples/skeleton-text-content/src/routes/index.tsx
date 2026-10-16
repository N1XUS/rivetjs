// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/text-content.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: Text Content" };

// #region demo
export function TextContent() {
  return (
    <div class="w-full max-w-md space-y-3">
      <Skeleton class="h-4 w-full rounded" />
      <Skeleton class="h-4 w-5/6 rounded" />
      <Skeleton class="h-4 w-4/6 rounded" />
      <Skeleton class="h-4 w-full rounded" />
      <Skeleton class="h-4 w-3/6 rounded" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TextContent />
    </div>
  );
}
