import { signal } from "@rivetjs/reactivity";
import { invalidate, Link } from "@rivetjs/router/client";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Modal } from "@rivetjs/cdk/modal";
import { Popover } from "@rivetjs/cdk/popover";
import { Drawer } from "@rivetjs/ui/drawer";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Overlays" };

let loads = 0;
// Not a live page: a revalidation re-renders it (open overlays must be disposed with it).
export const serverLoad = () => ({ loads: ++loads });

/** One overlay of each kind, each holding a revalidation button and a link away (overlay leak regression). */
export default function Overlays({ data }: { data: { loads: number } }) {
  const modal = signal(false);
  const clicks = signal(0);
  return (
    <section>
      <h1>Overlays</h1>
      <p id="loads">{data.loads}</p>
      <button id="clicks" type="button" onClick={() => clicks.update((n) => n + 1)}>
        Clicked {clicks()}
      </button>
      <Link id="to-other" to="/other">
        Other page
      </Link>
      <button id="modal-open" type="button" onClick={() => modal.set(true)}>
        Modal
      </button>
      <Modal isDismissable isOpen={modal}>
        <Dialog id="modal-dialog">
          <Heading slot="title">Modal</Heading>
          <button id="modal-refresh" type="button" onClick={() => invalidate()}>
            Refresh
          </button>
          <Link id="modal-away" to="/other">
            Away
          </Link>
        </Dialog>
      </Modal>
      <DialogTrigger>
        <Button id="popover-open">Popover</Button>
        <Popover>
          <Dialog id="popover-dialog">
            <button id="popover-refresh" type="button" onClick={() => invalidate()}>
              Refresh
            </button>
            <Link id="popover-away" to="/other">
              Away
            </Link>
          </Dialog>
        </Popover>
      </DialogTrigger>
      <Drawer>
        <Drawer.Trigger id="drawer-open">Drawer</Drawer.Trigger>
        <Drawer.Backdrop>
          <Drawer.Container>
            <Drawer.Dialog id="drawer-dialog">
              <Drawer.Heading>Drawer</Drawer.Heading>
              <button id="drawer-refresh" type="button" onClick={() => invalidate()}>
                Refresh
              </button>
              <Link id="drawer-away" to="/other">
                Away
              </Link>
            </Drawer.Dialog>
          </Drawer.Container>
        </Drawer.Backdrop>
      </Drawer>
      <Sheet>
        <Sheet.Trigger id="sheet-open">Sheet</Sheet.Trigger>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog id="sheet-dialog">
              <Sheet.Heading>Sheet</Sheet.Heading>
              <button id="sheet-refresh" type="button" onClick={() => invalidate()}>
                Refresh
              </button>
              <Link id="sheet-away" to="/other">
                Away
              </Link>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
    </section>
  );
}
