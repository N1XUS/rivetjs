// Rivet-authored HoverCard demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { HoverCard } from "@rivetjs/ui/hover-card";

export const head = { title: "HoverCard: Placements" };

// #region demo
const PLACEMENTS = ["top", "bottom", "left", "right"] as const;

export function Placements() {
  return (
    <div id="hc-placements" class="grid grid-cols-2 gap-x-16 gap-y-6 text-sm">
      {PLACEMENTS.map((placement) => (
        <HoverCard openDelay={0}>
          <HoverCard.Trigger id={`hc-placement-${placement}`} class="rounded-lg bg-default px-3 py-1.5 font-medium">
            {placement}
          </HoverCard.Trigger>
          <HoverCard.Content placement={placement} aria-label={`Placed ${placement}`}>
            <HoverCard.Arrow />
            <p class="w-32 text-muted">Card on the {placement}.</p>
          </HoverCard.Content>
        </HoverCard>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Placements />
    </div>
  );
}
