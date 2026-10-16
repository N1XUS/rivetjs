// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Input: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex w-[240px] flex-col gap-2">
      <Input fullWidth placeholder="Primary input" variant="primary" />
      <Input fullWidth placeholder="Secondary input" variant="secondary" />
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
