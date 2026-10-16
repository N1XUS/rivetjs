import { Button } from "@rivetjs/cdk/button";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";

export const head = { title: "Tooltip placement" };

// #region demo
export default function Placement() {
  return (
    <section class="grid gap-16 p-1 text-sm">
      {/* At the top edge: no room above. */}
      <div class="flex gap-2">
        <TooltipTrigger>
          <Button>top (flips)</Button>
          <Tooltip id="tp-flip">
            <OverlayArrow>
              <span class="tip" />
            </OverlayArrow>
            Flipped below
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button>shouldFlip false</Button>
          <Tooltip id="tp-noflip" shouldFlip={false}>
            Clipped above
          </Tooltip>
        </TooltipTrigger>
      </div>
      <div class="flex justify-center gap-24">
        <TooltipTrigger>
          <Button>right</Button>
          <Tooltip id="tp-right" placement="right" offset={8}>
            <OverlayArrow>
              <span class="tip" />
            </OverlayArrow>
            Right, 8px away
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button>left</Button>
          <Tooltip id="tp-left" placement="left">
            <OverlayArrow>
              <span class="tip" />
            </OverlayArrow>
            Left
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button>bottom start</Button>
          <Tooltip id="tp-bottom" placement="bottom start" crossOffset={6}>
            Bottom start, 6px along
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button>end</Button>
          <Tooltip id="tp-end" placement="end">
            End
          </Tooltip>
        </TooltipTrigger>
      </div>
    </section>
  );
}
// #endregion
