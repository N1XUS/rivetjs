import { Button } from "@rivetjs/cdk/button";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { Copy } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tooltip with Tailwind" };

// #region demo
export default function Tailwind() {
  return (
    <section class="mx-4 mt-12 text-sm">
      <TooltipTrigger>
        <Button id="ttw-button" aria-label="Copy" class="rounded-md border border-slate-300 p-2 focus-visible:outline-2 focus-visible:outline-indigo-600">
          <Icon icon={Copy} />
        </Button>
        <Tooltip
          id="ttw"
          offset={6}
          class="rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow [transform-origin:var(--trigger-anchor-point)] transition-[opacity,translate] duration-150 entering:opacity-0 exiting:opacity-0 exiting:duration-100 placement-top:entering:translate-y-1 placement-bottom:entering:-translate-y-1"
        >
          <OverlayArrow class="block placement-bottom:rotate-180 placement-left:-rotate-90 placement-right:rotate-90">
            <span class="block h-1 w-2 bg-slate-900 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </OverlayArrow>
          Copy to clipboard
        </Tooltip>
      </TooltipTrigger>
    </section>
  );
}
// #endregion
