// RAC Dialog.ssr.test.js example (Sign up form in an open DialogTrigger), as a Rivet component.
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal } from "@rivetjs/cdk/modal";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";

export function SignUp() {
  return (
    <DialogTrigger isOpen>
      <Button>Sign up…</Button>
      <Modal>
        <Dialog>
          {() => (
            <form>
              <Heading slot="title">Sign up</Heading>
              <label>
                First Name: <input autoFocus />
              </label>
              <label>
                Last Name: <input />
              </label>
              {/* RAC: <Button onPress={close}>; slot="close" (same close) — see dialog-ssr.test.ts header. */}
              <Button slot="close">Submit</Button>
            </form>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}

/** The title keeps its own id (RA mergeIds): the server HTML's aria-labelledby points at it. */
export function SignUpCustomId() {
  return (
    <DialogTrigger isOpen>
      <Button>Sign up…</Button>
      <Modal>
        <Dialog>
          {() => (
            <form>
              <Heading slot="title" id="sign-up-title">
                Sign up
              </Heading>
              <Button slot="close">Submit</Button>
            </form>
          )}
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}

/** The Dialog keeps its own id (RA mergeIds): the open trigger's server aria-controls points at it. */
export function SignUpDialogId() {
  return (
    <DialogTrigger isOpen>
      <Button>Sign up…</Button>
      <Modal>
        <Dialog id="sign-up-dialog">
          <Heading slot="title">Sign up</Heading>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
}
