import { Button } from "@rivetjs/cdk/button";
import { Focusable } from "@rivetjs/cdk/focusable";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Tooltip options" };

// #region demo
export default function Options() {
  return (
    <section class="mx-4 mt-12 flex items-center gap-2 text-sm">
      <TooltipTrigger isDisabled delay={0}>
        <Button id="to-disabled-button">isDisabled</Button>
        <Tooltip id="to-disabled">Never shown</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger trigger="focus" delay={0}>
        <Button id="to-focus-button">trigger focus</Button>
        <Tooltip id="to-focus">Keyboard focus only</Tooltip>
      </TooltipTrigger>
      {/* A custom trigger: Focusable passes the trigger props to the element (spread them, pass the ref). */}
      <TooltipTrigger>
        <Focusable>
          {(p) => (
            <span {...p} ref={p.ref as never} id="to-span-trigger" role="button" class="rounded border border-dashed border-slate-400 px-2 py-1">
              Custom trigger
            </span>
          )}
        </Focusable>
        <Tooltip id="to-span">Any focusable element</Tooltip>
      </TooltipTrigger>
    </section>
  );
}
// #endregion
