// Modal on a resumed page (upstream modal fixture + browser test): `#mo-trigger` Button opens `#mo-dialog` (close trigger,
// heading, body action `#mo-inside`, footer `#mo-continue` slot=close); `#mo-mtrigger` `Modal.Trigger` (div role=button) opens
// `#mo-mdialog` (blur backdrop, placement top, size sm); `#mo-open` / `#mo-toggle` drive `useOverlayState` + `state` prop
// (`#mo-sdialog`, render-function children with `close` → `#mo-sclose`), state in `#mo-state`; `#mo-nd` non-dismissable
// backdrop (`#mo-nddialog`).
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";
import { useOverlayState } from "@rivetjs/ui";

export default function ModalStories() {
  const state = useOverlayState();
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <Modal>
        <Button id="mo-trigger">Open modal</Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog id="mo-dialog">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Welcome</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p>Modal body content</p>
                <Button id="mo-inside">Inside action</Button>
              </Modal.Body>
              <Modal.Footer>
                <Button id="mo-continue" slot="close">
                  Continue
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Trigger id="mo-mtrigger">
          <p class="font-semibold">Settings</p>
        </Modal.Trigger>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="top" size="sm">
            <Modal.Dialog id="mo-mdialog">
              <Modal.Header>
                <Modal.Heading>Settings</Modal.Heading>
              </Modal.Header>
              <Modal.Body>Preferences</Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <div class="flex gap-2">
        <Button id="mo-open" onPress={() => state.open()}>
          Open state
        </Button>
        <Button id="mo-toggle" onPress={() => state.toggle()}>
          Toggle state
        </Button>
        <output id="mo-state">{state.isOpen() ? "open" : "closed"}</output>
      </div>
      <Modal state={state}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog id="mo-sdialog">
              {({ close }) => (
                <>
                  <Modal.Header>
                    <Modal.Heading>Controlled</Modal.Heading>
                  </Modal.Header>
                  <Modal.Footer>
                    <Button id="mo-sclose" onPress={() => close()}>
                      Done
                    </Button>
                  </Modal.Footer>
                </>
              )}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Button id="mo-nd">Non-dismissable</Button>
        <Modal.Backdrop isDismissable={false}>
          <Modal.Container>
            <Modal.Dialog id="mo-nddialog">
              <Modal.Header>
                <Modal.Heading>Locked</Modal.Heading>
              </Modal.Header>
              <Modal.Footer>
                <Button slot="close">Close</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
