// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: Usage" };

// #region demo
export function Basic() {
  return (
    <div class="max-w-md">
      <div class="space-y-1">
        <h4 class="text-medium font-medium">Rivet UI Components</h4>
        <p class="text-small text-default-400">Beautiful, fast and modern React UI library.</p>
      </div>
      <Separator class="my-4" />
      <div class="text-small flex h-5 items-center space-x-4">
        <div>Blog</div>
        <Separator orientation="vertical" />
        <div>Docs</div>
        <Separator orientation="vertical" />
        <div>Source</div>
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
