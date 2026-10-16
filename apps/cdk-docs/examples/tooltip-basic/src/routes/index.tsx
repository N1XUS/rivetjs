import { Button } from "@rivetjs/cdk/button";
import { OverlayArrow } from "@rivetjs/cdk/overlay-arrow";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { Pencil, Trash } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "TooltipTrigger" };

// #region demo
export default function Toolbar() {
  return (
    <section class="mx-4 mt-12 flex gap-2 text-sm">
      <TooltipTrigger>
        <Button id="tip-edit-button" aria-label="Edit">
          <Icon icon={Pencil} />
        </Button>
        <Tooltip id="tip-edit">
          <OverlayArrow>
            <span class="tip" />
          </OverlayArrow>
          Edit
        </Tooltip>
      </TooltipTrigger>
      <TooltipTrigger>
        <Button id="tip-delete-button" aria-label="Delete">
          <Icon icon={Trash} />
        </Button>
        <Tooltip id="tip-delete">Delete</Tooltip>
      </TooltipTrigger>
      <button type="button" class="rounded border border-slate-300 px-2">
        No tooltip
      </button>
    </section>
  );
}
// #endregion
