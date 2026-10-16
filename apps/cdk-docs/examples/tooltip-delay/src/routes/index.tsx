import { Button } from "@rivetjs/cdk/button";
import { Tooltip, TooltipTrigger } from "@rivetjs/cdk/tooltip";
import { Save, SquarePen } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Tooltip interactions" };

// #region demo
export default function Interactions() {
  return (
    <section class="mx-4 mt-12 flex gap-2 text-sm">
      {/* Defaults: 1500 ms hover warmup, 500 ms close delay, a press closes it. */}
      <TooltipTrigger>
        <Button id="td-edit-button" aria-label="Edit">
          <Icon icon={SquarePen} />
        </Button>
        <Tooltip id="td-edit">Edit</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={0} closeDelay={0} shouldCloseOnPress={false}>
        <Button id="td-save-button" aria-label="Save">
          <Icon icon={Save} />
        </Button>
        <Tooltip id="td-save">Save (opens at once, stays on press)</Tooltip>
      </TooltipTrigger>
    </section>
  );
}
// #endregion
