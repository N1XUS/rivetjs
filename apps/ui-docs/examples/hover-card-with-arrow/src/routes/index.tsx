// Rivet-authored HoverCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { HoverCard } from "@rivetjs/ui/hover-card";

export const head = { title: "HoverCard: With Arrow" };

// #region demo
export function WithArrow() {
  return (
    <p id="hc-arrow" class="text-sm">
      Built with{" "}
      <HoverCard openDelay={0}>
        <HoverCard.Trigger class="font-medium text-accent underline decoration-dotted underline-offset-4">signals</HoverCard.Trigger>
        <HoverCard.Content aria-label="Signals">
          <HoverCard.Arrow />
          <p class="w-56 text-muted">A signal holds a value and updates exactly the parts of the page that read it.</p>
        </HoverCard.Content>
      </HoverCard>
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <WithArrow />
    </div>
  );
}
