// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/label/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Label: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex flex-col gap-1.5">
      <Label class="text-xs font-semibold tracking-wide text-accent uppercase" for="repo">
        Repository
      </Label>
      <Input class="w-64 bg-field" id="repo" placeholder="rivetjs/rivet" />
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
