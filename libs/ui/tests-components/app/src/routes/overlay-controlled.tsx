// Overlays controlled by a plain value (`isOpen={open()}` + `onOpenChange`), opened by a Button outside the overlay root: the
// React habit (AI-ADOPT 2026-11-05: a cold agent wrote it, the drawer never opened on the resumed page). `#oc-<kind>-open`
// opens, `#oc-<kind>-dialog` is the dialog, `#oc-<kind>-close` closes through `onOpenChange`.
import { signal } from "@rivetjs/reactivity";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";
import { Modal } from "@rivetjs/ui/modal";

export default function OverlayControlledStories() {
  const drawer = signal(false);
  const modal = signal(false);
  const alert = signal(false);
  return (
    <section class="p-10">
      <Button id="oc-drawer-open" onPress={() => drawer.set(true)}>
        Open drawer
      </Button>
      <Button id="oc-modal-open" onPress={() => modal.set(true)}>
        Open modal
      </Button>
      <Button id="oc-alert-open" onPress={() => alert.set(true)}>
        Open alert dialog
      </Button>
      <output id="oc-state">
        {drawer() ? "drawer" : "-"} {modal() ? "modal" : "-"} {alert() ? "alert" : "-"}
      </output>
      <Drawer isOpen={drawer()} onOpenChange={(v: boolean) => drawer.set(v)} placement="right">
        <Drawer.Content id="oc-drawer-dialog">
          <Drawer.Header>
            <Drawer.Heading>Drawer</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Footer>
            <Button id="oc-drawer-close" slot="close">
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer>
      <Modal isOpen={modal()} onOpenChange={(v: boolean) => modal.set(v)}>
        <Modal.Content id="oc-modal-dialog">
          <Modal.Header>
            <Modal.Heading>Modal</Modal.Heading>
          </Modal.Header>
          <Modal.Footer>
            <Button id="oc-modal-close" slot="close">
              Close
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
      <AlertDialog isOpen={alert()} onOpenChange={(v: boolean) => alert.set(v)}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog id="oc-alert-dialog">
              <AlertDialog.Header>
                <AlertDialog.Heading>Alert</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <Button id="oc-alert-close" slot="close">
                  Close
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
