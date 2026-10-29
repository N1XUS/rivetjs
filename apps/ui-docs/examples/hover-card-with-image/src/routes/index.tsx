// Rivet-authored HoverCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Link } from "@rivetjs/ui/link";
import { HoverCard } from "@rivetjs/ui/hover-card";
import pineImage from "../assets/cover-pine.jpg?image";

export const head = { title: "HoverCard: With Image" };

// #region demo
export function WithImage() {
  return (
    <p id="hc-image" class="max-w-sm text-sm">
      Read the{" "}
      <HoverCard openDelay={300}>
        <HoverCard.Trigger tabIndex={-1}>
          <Link href="#trail-guide">trail guide</Link>
        </HoverCard.Trigger>
        <HoverCard.Content aria-label="Trail guide preview" class="w-72 overflow-hidden p-0">
          <img alt="" src={pineImage.src} width={pineImage.width} height={pineImage.height} class="h-32 w-full object-cover" />
          <div class="flex flex-col gap-1 p-4">
            <span class="font-medium">The pine ridge loop</span>
            <span class="text-muted">Eleven kilometres through old forest, with two lookouts over the valley.</span>
          </div>
        </HoverCard.Content>
      </HoverCard>{" "}
      before you go.
    </p>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-end justify-center p-6 pb-10">
      <WithImage />
    </div>
  );
}
