// Rivet-authored HoverCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { HoverCard } from "@rivetjs/ui/hover-card";

export const head = { title: "HoverCard: Custom Delays" };

// #region demo
const DELAYS = [
  { label: "Instant", open: 0, close: 0 },
  { label: "Default", open: 700, close: 300 },
  { label: "Slow", open: 1200, close: 800 },
];

export function CustomDelays() {
  return (
    <div id="hc-delays" class="flex flex-wrap items-center justify-center gap-6 text-sm">
      {DELAYS.map((delay) => (
        <HoverCard openDelay={delay.open} closeDelay={delay.close}>
          <HoverCard.Trigger id={`hc-delay-${delay.label.toLowerCase()}`} class="font-medium text-accent">
            {delay.label}
          </HoverCard.Trigger>
          <HoverCard.Content aria-label={`${delay.label} delay`}>
            <p class="w-48 text-muted">
              Opens after {delay.open} ms, closes {delay.close} ms after the pointer leaves.
            </p>
          </HoverCard.Content>
        </HoverCard>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <CustomDelays />
    </div>
  );
}
