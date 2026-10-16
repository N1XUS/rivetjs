// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex max-w-md flex-col items-center gap-3">
      <div>Default Variant</div>
      <Separator variant="default" />
      <div>Secondary Variant</div>
      <Separator variant="secondary" />
      <div>Tertiary Variant</div>
      <Separator variant="tertiary" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
