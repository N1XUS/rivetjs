import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover with an arrow" };

// #region demo
export default function Arrow() {
  return (
    <section class="m-4 flex gap-6 text-sm">
      <DialogTrigger>
        <Button id="arrow-down-trigger">Below</Button>
        <Popover placement="bottom" offset={12} class="rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
          {/* The tip points down; rotate it for the side the engine picked (placement-* variants on the arrow element). */}
          <OverlayArrow class="arrow placement-bottom:rotate-180 placement-left:-rotate-90 placement-right:rotate-90">
            <span class="block h-1.5 w-3 bg-slate-300 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </OverlayArrow>
          <Dialog id="arrow-down" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Arrow
            </Heading>
            <p>Positioned by the engine.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="arrow-right-trigger">Right</Button>
        <Popover placement="right" offset={12} class="rounded-lg border border-slate-300 bg-white p-3 shadow-lg">
          <OverlayArrow class="arrow placement-bottom:rotate-180 placement-left:-rotate-90 placement-right:rotate-90">
            <span class="block h-1.5 w-3 bg-slate-300 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          </OverlayArrow>
          <Dialog id="arrow-right" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Arrow
            </Heading>
            <p>Same arrow, rotated.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
