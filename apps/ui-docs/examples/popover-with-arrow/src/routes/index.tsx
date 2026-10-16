// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/with-arrow.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Ellipsis } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export const head = { title: "Popover: With Arrow" };

// #region demo
export function PopoverWithArrow() {
  return (
    <div class="flex items-center gap-4">
      <Popover>
        <Button variant="secondary">With Arrow</Button>
        <Popover.Content class="max-w-64" title="Popover with Arrow">
          <Popover.Arrow />
          <p class="mt-2 text-sm text-muted">The arrow shows which element triggered the popover.</p>
        </Popover.Content>
      </Popover>

      <Popover>
        <Button isIconOnly aria-label="More options" variant="tertiary">
          <Icon icon={Ellipsis} />
        </Button>
        <Popover.Content class="max-w-64" offset={10} title="Popover with Arrow">
          <Popover.Arrow />
          <p class="mt-2 text-sm text-muted">The arrow shows which element triggered the popover.</p>
        </Popover.Content>
      </Popover>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PopoverWithArrow />
    </div>
  );
}
