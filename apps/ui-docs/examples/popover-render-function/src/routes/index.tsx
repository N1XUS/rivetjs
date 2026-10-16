// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export const head = { title: "Popover: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <div class="flex items-center gap-4">
      <Popover>
        <Button>Click me</Button>
        <Popover.Content class="max-w-64" render={(props) => <div {...props} data-custom="foo" />} title="Popover Title">
          <p class="mt-2 text-sm text-muted">This is the popover content. You can put any content here.</p>
        </Popover.Content>
      </Popover>
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
