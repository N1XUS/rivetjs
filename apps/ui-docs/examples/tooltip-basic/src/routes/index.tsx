// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tooltip/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Info } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export const head = { title: "Tooltip: Usage" };

// #region demo
export function TooltipBasic() {
  return (
    <div class="flex items-center gap-4">
      <Tooltip delay={0}>
        <Button variant="secondary">Hover me</Button>
        <Tooltip.Content>
          <p>This is a tooltip</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip delay={0}>
        <Button isIconOnly aria-label="More information" variant="tertiary">
          <Icon icon={Info} />
        </Button>
        <Tooltip.Content>
          <p>More information</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TooltipBasic />
    </div>
  );
}
