import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Controlled tooltips" };

// #region demo
export default function Controlled() {
  const open = signal(false);
  const log = signal<string[]>([]);
  // Standalone: a Tooltip positioned against any element, open state in a signal.
  const anchor = ref<HTMLSpanElement>();
  const explain = signal(false);
  return (
    <section class="mx-4 mt-10 grid justify-items-start gap-3 text-sm">
      <div class="flex gap-2">
        <TooltipTrigger isOpen={open} onOpenChange={(isOpen) => log.update((l) => [...l, isOpen ? "open" : "close"])}>
          <Button>Target</Button>
          <Tooltip id="tc-trigger-tip">Controlled</Tooltip>
        </TooltipTrigger>
        <Button id="tc-show" onPress={() => open.set(true)}>
          Show
        </Button>
        <Button id="tc-hide" onPress={() => open.set(false)}>
          Hide
        </Button>
      </div>
      <div class="flex items-center gap-2">
        <span id="tc-anchor" ref={anchor} class="rounded bg-amber-100 px-2">
          New
        </span>
        <Button id="tc-toggle-standalone" onPress={() => explain.set(!explain())}>
          {explain() ? "Got it" : "Explain"}
        </Button>
      </div>
      <Tooltip id="tc-standalone" triggerRef={anchor} isOpen={explain} placement="bottom">
        Shown on request
      </Tooltip>
      <p id="tc-state">trigger={open() ? "open" : "closed"}</p>
      <output id="tc-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
