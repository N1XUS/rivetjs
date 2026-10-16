import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Controlled dialogs" };

// #region demo
export default function Controlled() {
  const dialogOpen = signal(false);
  const modalOpen = signal(false);
  const log = signal<string[]>([]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <div class="flex gap-2">
        <DialogTrigger isOpen={dialogOpen} onOpenChange={(isOpen) => log.update((l) => [...l, isOpen ? "open" : "close"])}>
          <Button id="ctl-dialog-trigger">Settings</Button>
          <Modal>
            <Dialog id="ctl-dialog">
              <Heading slot="title">Settings</Heading>
              <p>Opened by the trigger or from outside.</p>
            </Dialog>
          </Modal>
        </DialogTrigger>
        <Button id="ctl-open-elsewhere" onPress={() => dialogOpen.set(true)}>
          Open settings from here
        </Button>
        <Button id="ctl-open-modal" onPress={() => modalOpen.set(true)}>
          Show notice
        </Button>
      </div>
      {/* A standalone Modal: no trigger, the open signal is the state. */}
      <Modal isOpen={modalOpen} onOpenChange={(isOpen) => log.update((l) => [...l, isOpen ? "modal:open" : "modal:close"])}>
        <Dialog id="ctl-modal" aria-label="Notice">
          {({ close }) => (
            <>
              <p>A Modal without a trigger.</p>
              <Button id="ctl-modal-close" class="mt-3 rounded border border-slate-300 px-3 py-1" onPress={() => close()}>
                OK
              </Button>
            </>
          )}
        </Dialog>
      </Modal>
      <p id="ctl-state">
        trigger={dialogOpen() ? "open" : "closed"} modal={modalOpen() ? "open" : "closed"}
      </p>
      <p id="ctl-log">{log().join(" ")}</p>
    </section>
  );
}
// #endregion
