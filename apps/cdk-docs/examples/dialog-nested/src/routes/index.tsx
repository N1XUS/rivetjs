import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";

export const head = { title: "Nested dialogs" };

// #region demo
export default function Nested() {
  return (
    <section class="m-4 text-sm">
      <DialogTrigger>
        <Button id="outer-trigger">Account</Button>
        <Modal isDismissable>
          <Dialog id="outer">
            {/* Content with its own resumable component: a render function, created on open. */}
            {() => (
              <div class="mt-3 grid justify-items-start gap-2">
                <Heading slot="title">Account</Heading>
                <p>Signed in as ada@example.com.</p>
                <DialogTrigger>
                  <Button id="inner-trigger">Change password…</Button>
                  <Modal isDismissable>
                    <Dialog id="inner">
                      <Heading slot="title">Change password</Heading>
                      <p>A second modal above the first.</p>
                    </Dialog>
                  </Modal>
                </DialogTrigger>
              </div>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
    </section>
  );
}
// #endregion
