import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";

export const head = { title: "Dialog events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-7), entry]);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <DialogTrigger onOpenChange={(isOpen) => add(isOpen ? "open" : "close")}>
        {/* Each part takes its own DOM attributes and events. */}
        <Button id="ev-dialog-trigger" lang="en" onClick={() => add("trigger:click")} onContextMenu={() => add("trigger:contextmenu")}>
          Open
        </Button>
        <ModalOverlay dir="ltr" onPointerDown={() => add("underlay:pointerdown")}>
          <Modal lang="fr" onPointerEnter={() => add("modal:enter")} onClick={() => add("modal:click")} onDblClick={() => add("modal:dblclick")}>
            <Dialog id="ev-dialog">
              <Heading slot="title">Préférences</Heading>
              <p id="ev-dialog-body" class="py-4">
                Click, double-click or hover here.
              </p>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <output id="ev-log" class="block min-h-6 font-mono text-xs">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
