import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Popover with Tailwind" };

// #region demo
export default function Tailwind() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        <Button
          id="ptw-trigger"
          class="rounded-md border border-slate-300 px-3 py-1.5 outline-none aria-expanded:bg-slate-900 aria-expanded:text-white focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          Notifications
        </Button>
        <Popover
          id="ptw"
          // entering: / exiting: (data-entering / data-exiting) and placement-* from @rivetjs/cdk/tailwind.css.
          class="w-64 rounded-lg bg-white p-3 shadow-xl ring-1 ring-slate-900/10 outline-none entering:animate-pop-in exiting:animate-pop-out placement-bottom:origin-top placement-top:origin-bottom"
        >
          <Dialog id="ptw-dialog" class="outline-none">
            <Heading slot="title" class="m-0 mb-1 text-sm font-semibold">
              Notifications
            </Heading>
            <p class="text-slate-600">You are all caught up.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </section>
  );
}
// #endregion
