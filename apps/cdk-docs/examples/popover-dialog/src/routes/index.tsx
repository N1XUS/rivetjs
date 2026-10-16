import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Dialog in a popover" };

// #region demo
export default function Share() {
  const status = signal("");
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <DialogTrigger>
        <Button id="share-trigger">Share</Button>
        <Popover class="rounded-lg border border-slate-300 bg-white shadow-lg">
          <Dialog id="share-dialog" class="p-3 outline-none">
            {/* The close render prop closes the popover around the dialog. */}
            {({ close }) => (
              <>
                <Heading slot="title" class="m-0 text-sm font-semibold">
                  Share
                </Heading>
                <button
                  id="share-copy"
                  type="button"
                  class="mt-2 rounded bg-teal-700 px-3 py-1 text-white"
                  onClick={() => {
                    status.set("Link copied");
                    close();
                  }}
                >
                  Copy link
                </button>
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <p id="share-status">{status()}</p>
    </section>
  );
}
// #endregion
