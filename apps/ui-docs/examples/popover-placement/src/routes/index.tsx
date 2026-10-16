// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/placement.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export const head = { title: "Popover: Placement" };

// #region demo
export function PopoverPlacement() {
  return (
    <div class="grid grid-cols-3 gap-4">
      <div />
      <Popover>
        <Button class="w-full" variant="tertiary">
          Top
        </Button>
        <Popover.Content placement="top">
          <Popover.Arrow />
          <p class="text-sm">Top placement</p>
        </Popover.Content>
      </Popover>
      <div />

      <Popover>
        <Button class="w-full" variant="tertiary">
          Left
        </Button>
        <Popover.Content placement="left">
          <Popover.Arrow />
          <p class="text-sm">Left placement</p>
        </Popover.Content>
      </Popover>

      <div class="flex items-center justify-center">
        <span class="text-sm text-muted">Click buttons</span>
      </div>

      <Popover>
        <Button class="w-full" variant="tertiary">
          Right
        </Button>
        <Popover.Content placement="right">
          <Popover.Arrow />
          <p class="text-sm">Right placement</p>
        </Popover.Content>
      </Popover>

      <div />
      <Popover>
        <Button class="w-full" variant="tertiary">
          Bottom
        </Button>
        <Popover.Content placement="bottom">
          <Popover.Arrow />
          <p class="text-sm">Bottom placement</p>
        </Popover.Content>
      </Popover>
      <div />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PopoverPlacement />
    </div>
  );
}
