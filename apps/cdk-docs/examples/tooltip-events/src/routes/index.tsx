import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Tooltip events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-7), entry]);
  return (
    <section class="mx-4 mt-12 grid justify-items-start gap-3 text-sm">
      <TooltipTrigger onOpenChange={(isOpen) => add(isOpen ? "open" : "close")}>
        {/* TooltipTrigger renders no element: trigger events go on the trigger and run with the tooltip's. */}
        <Button id="te-button" onPress={() => add("button:press")} onFocus={() => add("button:focus")} onBlur={() => add("button:blur")}>
          Help
        </Button>
        {/* Global DOM props and data-* land on the tooltip element. */}
        <Tooltip id="te" lang="nl" data-tone="info" onPointerEnter={() => add("tooltip:enter")}>
          <OverlayArrow lang="sv" data-part="arrow">
            <span class="tip" />
          </OverlayArrow>
          Hulp
        </Tooltip>
      </TooltipTrigger>
      <Button id="te-next">Next</Button>
      <output id="te-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
