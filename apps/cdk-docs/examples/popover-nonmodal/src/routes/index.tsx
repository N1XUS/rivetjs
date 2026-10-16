import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Non-modal popover" };

// #region demo
export default function NonModal() {
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <div class="flex gap-2">
        <DialogTrigger>
          <Button id="nm-trigger">Non-modal</Button>
          <Popover isNonModal placement="bottom start">
            <Dialog id="nm">
              <Heading slot="title" class="m-0 text-sm font-semibold">
                Filters
              </Heading>
              <button id="nm-inside" type="button" class="rounded border border-slate-300 px-2">
                Apply
              </button>
            </Dialog>
          </Popover>
        </DialogTrigger>
        <DialogTrigger>
          <Button id="locked-trigger">Escape disabled</Button>
          <Popover isKeyboardDismissDisabled>
            <Dialog id="locked">
              <Heading slot="title" class="m-0 text-sm font-semibold">
                Locked
              </Heading>
              <p>Click outside to close.</p>
            </Dialog>
          </Popover>
        </DialogTrigger>
      </div>
      <button id="nm-outside" type="button" class="rounded border border-slate-300 px-2">
        Outside
      </button>
    </section>
  );
}
// #endregion
