// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/tooltip/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Tooltip } from "@rivetjs/ui/tooltip";

export const head = { title: "Tooltip: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Tooltip delay={0}>
      <Button variant="secondary">Share link</Button>
      <Tooltip.Content class="rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs text-foreground shadow-sm">
        <p>Copied to clipboard</p>
      </Tooltip.Content>
    </Tooltip>
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
