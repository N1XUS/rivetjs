// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/separator/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Separator } from "@rivetjs/ui/separator";

export const head = { title: "Separator: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <div class="max-w-md">
      <div class="space-y-1">
        <h4 class="text-medium font-medium">Rivet UI Components</h4>
        <p class="text-small text-default-400">Beautiful, fast and modern React UI library.</p>
      </div>
      <Separator class="my-4" render={(props: Record<string, any>) => <div {...props} data-custom="foo" />} />
      <div class="text-small flex h-5 items-center space-x-4">
        <div>Blog</div>
        <Separator orientation="vertical" render={(props: Record<string, any>) => <div {...props} data-custom="foo" />} />
        <div>Docs</div>
        <Separator orientation="vertical" render={(props: Record<string, any>) => <div {...props} data-custom="foo" />} />
        <div>Source</div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
