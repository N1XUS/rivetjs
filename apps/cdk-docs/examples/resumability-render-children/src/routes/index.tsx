import { signal } from "@rivetjs/reactivity";
import { Popover } from "@rivetjs/cdk/popover";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "Render-function children" };

// #region demo
export default function Filters() {
  const onlyOpen = signal(false);
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <DialogTrigger>
        <Button id="filters-trigger" class="rounded-md border border-slate-300 px-3 py-1.5">
          Filters
        </Button>
        <Popover placement="bottom start" class="w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <Dialog id="filters" class="grid gap-2 outline-none">
            {/* A render function: the components inside are created when the dialog opens, with `close` in scope. */}
            {({ close }) => (
              <>
                <Heading slot="title" class="m-0 text-sm font-semibold">
                  Filters
                </Heading>
                <ToggleButton
                  id="only-open"
                  isSelected={onlyOpen}
                  class="rounded-md border border-slate-300 px-3 py-1.5 aria-pressed:bg-teal-700 aria-pressed:text-white"
                >
                  Only open issues
                </ToggleButton>
                <Button id="done" class="rounded-md bg-slate-900 px-3 py-1.5 text-white" onPress={() => close()}>
                  Done
                </Button>
              </>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <p id="value" class="text-slate-600">
        Only open issues: {onlyOpen() ? "yes" : "no"}
      </p>
    </section>
  );
}
// #endregion
