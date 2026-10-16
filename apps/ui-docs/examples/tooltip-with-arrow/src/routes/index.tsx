// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tooltip/with-arrow.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export const head = { title: "Tooltip: With Arrow" };

// #region demo
export function TooltipWithArrow() {
  return (
    <div class="flex items-center gap-4">
      <Tooltip delay={0}>
        <Button variant="secondary">With Arrow</Button>
        <Tooltip.Content showArrow>
          <Tooltip.Arrow />
          <p>Tooltip with arrow indicator</p>
        </Tooltip.Content>
      </Tooltip>

      <Tooltip delay={0}>
        <Button variant="primary">Custom Offset</Button>
        <Tooltip.Content showArrow offset={12}>
          <Tooltip.Arrow />
          <p>Custom offset from trigger</p>
        </Tooltip.Content>
      </Tooltip>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <TooltipWithArrow />
    </div>
  );
}
