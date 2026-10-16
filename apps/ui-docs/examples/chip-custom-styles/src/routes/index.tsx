// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/chip/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Chip: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex flex-wrap items-center gap-2">
      <Chip class="rounded-full bg-default-soft px-3 text-default-soft-foreground">Draft</Chip>
      <Chip class="rounded-full bg-warning-soft px-3 text-warning-soft-foreground">In review</Chip>
      <Chip class="rounded-full bg-success-soft px-3 text-success-soft-foreground">Published</Chip>
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
