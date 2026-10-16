// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export const head = { title: "Popover: Usage" };

// #region demo
export function PopoverBasic() {
  return (
    <div class="flex items-center gap-4">
      <Popover>
        <Button>Click me</Button>
        <Popover.Content class="max-w-64" title="Popover Title">
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
      <PopoverBasic />
    </div>
  );
}
