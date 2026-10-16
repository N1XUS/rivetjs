import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-7), entry]);
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <DialogTrigger onOpenChange={(isOpen) => add(isOpen ? "open" : "close")}>
        {/* The trigger: a Button with its own DOM props (its press handling runs first). */}
        <Button id="pe-trigger" dir="ltr" onClick={() => add("trigger:click")}>
          Info
        </Button>
        <Popover
          // Global DOM props on the popover element.
          lang="es"
          onPointerEnter={() => add("popover:enter")}
          onClick={() => add("popover:click")}
          onWheel={() => add("popover:wheel")}
        >
          <OverlayArrow lang="pt" onContextMenu={() => add("arrow:contextmenu")}>
            <span class="block h-1.5 w-3 bg-slate-300 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </OverlayArrow>
          <Dialog id="pe" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Información
            </Heading>
            <p id="pe-body" class="py-2">
              Hover, click or scroll here.
            </p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <output id="pe-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
