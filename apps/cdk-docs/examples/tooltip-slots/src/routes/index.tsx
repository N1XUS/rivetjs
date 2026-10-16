import { Button } from "@rivetjs/cdk/button";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Tooltip content" };

// #region demo
export default function Content() {
  return (
    <section class="mx-4 mt-12 flex gap-2 text-sm">
      {/* Any content: the Tooltip children render only while it is open. */}
      <TooltipTrigger>
        <Button>Save</Button>
        <Tooltip id="ts-rich">
          <strong>Shortcut</strong> <kbd class="rounded bg-white/20 px-1">Ctrl S</kbd>
        </Tooltip>
      </TooltipTrigger>
      {/* Render props: `placement()` is the side after flipping. */}
      <TooltipTrigger>
        <Button>Where?</Button>
        <Tooltip id="ts-where" placement="bottom" class={({ placement }) => `rv-Tooltip side-${placement() ?? "none"}`}>
          {({ placement }) => <>Shown at {placement()}</>}
        </Tooltip>
      </TooltipTrigger>
    </section>
  );
}
// #endregion
