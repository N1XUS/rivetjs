import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "Alert dialog" };

// #region demo
export default function Files() {
  const status = signal("report.pdf");
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <DialogTrigger>
        <Button id="delete-trigger">Delete file…</Button>
        <Modal>
          <Dialog id="delete" role="alertdialog">
            {({ close }) => (
              <>
                <Heading slot="title">Delete the file?</Heading>
                <Text slot="description">This cannot be undone.</Text>
                <div class="mt-4 flex justify-end gap-2">
                  <Button
                    id="delete-cancel"
                    class="rounded border border-slate-300 px-3 py-1"
                    onPress={() => {
                      status.set("Kept");
                      close();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    id="delete-confirm"
                    class="rounded bg-red-700 px-3 py-1 font-semibold text-white"
                    onPress={() => {
                      status.set("Deleted");
                      close();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
      <p id="delete-status">{status()}</p>
    </section>
  );
}
// #endregion
