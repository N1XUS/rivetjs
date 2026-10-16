// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: Tailwind CSS" };

// #region demo
const bone = "animate-shine rounded-lg bg-neutral-200/90 dark:bg-neutral-800/90";

export function CustomStyles() {
  return (
    <div class="w-[250px] space-y-5 rounded-xl border border-border/80 bg-surface p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <Skeleton class={`h-32 ${bone}`} />
      <div class="space-y-3">
        <Skeleton class={`h-3 w-3/5 ${bone}`} />
        <Skeleton class={`h-3 w-4/5 ${bone}`} />
        <Skeleton class={`h-3 w-2/5 ${bone}`} />
      </div>
    </div>
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
