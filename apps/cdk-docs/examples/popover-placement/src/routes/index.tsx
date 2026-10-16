import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Popover, type Placement } from "@rivetjs/cdk/popover";

export const head = { title: "Popover placement" };

// #region demo
/** One trigger + popover; the Dialog inside carries the id the tests use. */
function Place(props: { id: string; label: string; placement: Placement; offset?: number; crossOffset?: number; shouldFlip?: boolean; text: string }) {
  return (
    <DialogTrigger>
      <Button id={props.id + "-trigger"}>{props.label}</Button>
      <Popover placement={props.placement} offset={props.offset} crossOffset={props.crossOffset} shouldFlip={props.shouldFlip}>
        <Dialog id={props.id} aria-label={props.label}>
          {props.text}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export default function Placements() {
  return (
    <section class="grid gap-4 p-3 text-sm">
      {/* The first row sits at the top edge: there is no room above it. */}
      <div class="flex gap-2">
        <Place id="pl-flip" label="top (flips)" placement="top" text="Flipped below" />
        <Place id="pl-noflip" label="top, shouldFlip={false}" placement="top" shouldFlip={false} text="Stays above, clipped" />
      </div>
      <div class="grid grid-cols-3 justify-items-center gap-x-24 gap-y-16 pt-20">
        <span />
        <Place id="pl-top" label="top" placement="top" text="Above" />
        <span />
        <Place id="pl-left" label="left" placement="left" text="Left" />
        <Place id="pl-bottom" label="bottom start, offset 16" placement="bottom start" offset={16} crossOffset={8} text="Below, 16px away, 8px along" />
        <Place id="pl-right" label="right" placement="right" text="Right" />
        <Place id="pl-start" label="start" placement="start" text="Start" />
        <span />
        <Place id="pl-end" label="end" placement="end" text="End" />
      </div>
    </section>
  );
}
// #endregion
