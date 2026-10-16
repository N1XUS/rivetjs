// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/vertical.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: Vertical" };

// #region demo
export function Vertical() {
  return (
    <div class="text-small flex h-5 items-center space-x-4">
      <div>Blog</div>
      <Separator orientation="vertical" />
      <div>Docs</div>
      <Separator orientation="vertical" />
      <div>Source</div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Vertical />
    </div>
  );
}
