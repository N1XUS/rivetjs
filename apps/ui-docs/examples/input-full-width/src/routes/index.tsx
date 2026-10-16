// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Input: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-3">
      <Input fullWidth placeholder="Full width input" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
