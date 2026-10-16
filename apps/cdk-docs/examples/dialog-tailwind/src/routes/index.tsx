import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";

export const head = { title: "Dialog with Tailwind" };

// #region demo
export default function Tailwind() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        <Button id="tw-dialog-trigger" class="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white aria-expanded:bg-indigo-800">
          New project
        </Button>
        {/* The underlay: centering, backdrop, fade with the entering: / exiting: variants. */}
        <ModalOverlay class="fixed inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-150 entering:opacity-0 exiting:opacity-0">
          {/* The modal element: scale + fade; data-entering is removed once the transition ends. */}
          <Modal id="tw-modal" class="transition duration-200 ease-out entering:scale-95 entering:opacity-0 exiting:scale-95 exiting:opacity-0">
            <Dialog id="tw-dialog" class="w-80 rounded-xl bg-white p-5 shadow-2xl outline-none">
              <Heading slot="title" class="text-lg font-semibold">
                New project
              </Heading>
              <div class="mt-4 flex justify-end">
                <Button id="tw-dialog-close" slot="close" class="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-50">
                  Create
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    </section>
  );
}
// #endregion
