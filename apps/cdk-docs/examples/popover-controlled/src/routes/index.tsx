import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Controlled popover" };

// #region demo
export default function Controlled() {
  const open = signal(false);
  const options = signal(false);
  const anchor = ref<HTMLSpanElement>();
  const log = signal<string[]>([]);
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      {/* Custom anchor: no DialogTrigger; triggerRef positions it, the isOpen signal opens and closes it. */}
      <div class="flex items-center gap-3">
        <Button id="pc-open" onPress={() => open.set(true)}>
          Show unread
        </Button>
        <span id="pc-badge" ref={anchor} class="rounded-full bg-teal-700 px-2 text-white">
          3
        </span>
      </div>
      <Popover id="pc" triggerRef={anchor} isOpen={open} aria-label="Unread">
        <p>Three new messages.</p>
        <button id="pc-done" type="button" class="mt-2 rounded border border-slate-300 px-2" onClick={() => open.set(false)}>
          Mark as read
        </button>
      </Popover>
      <p id="pc-state">{open() ? "open" : "closed"}</p>
      {/* Controlled DialogTrigger: isOpen (two-way signal) + onOpenChange. */}
      <DialogTrigger isOpen={options} onOpenChange={(isOpen) => log.update((l) => [...l, isOpen ? "open" : "close"])}>
        <Button id="pc-menu-trigger">Options</Button>
        <Popover>
          <Dialog id="pc-menu" aria-label="Options">
            {({ close }) => (
              <button id="pc-menu-close" type="button" class="rounded border border-slate-300 px-2" onClick={() => close()}>
                Close
              </button>
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      <output id="pc-log" class="font-mono text-xs">
        {options() ? "options open" : "options closed"}: {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
