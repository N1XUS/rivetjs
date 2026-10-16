import { signal } from "@rivetjs/reactivity";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Modal, ModalOverlay } from "@rivetjs/cdk/modal";
import { Button } from "@rivetjs/cdk/button";
import { Heading } from "@rivetjs/cdk/heading";
import { Text } from "@rivetjs/cdk/text";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Modal" };

export default function ModalStory() {
  const changes = signal("");
  const controlled = signal(false);
  const fromMenu = signal(false);
  return (
    <section>
      <h1>Modal</h1>
      <DialogTrigger onOpenChange={(open: boolean) => changes.update((v) => v + (open ? "o" : "c"))}>
        <Button id="alert-trigger">Delete…</Button>
        <Modal>
          <Dialog id="alert" role="alertdialog">
            {({ close }) => (
              <>
                <Heading slot="title">Alert</Heading>
                <Text slot="description">This is the alert message.</Text>
                <button type="button" id="alert-close" onClick={() => close()}>
                  Close
                </button>
              </>
            )}
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="dismissable-trigger">Dismissable</Button>
        <Modal isDismissable>
          <Dialog id="dismissable">
            <Heading slot="title">Dismissable</Heading>
            <label>
              Name <input id="dismissable-name" autoFocus />
            </label>
            <DialogTrigger>
              <Button id="nested-trigger">Open nested</Button>
              <Modal isDismissable>
                <Dialog id="nested">
                  <Heading slot="title">Nested</Heading>
                  <p>Nested dialog</p>
                </Dialog>
              </Modal>
            </DialogTrigger>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="locked-trigger">Locked</Button>
        <Modal isDismissable isKeyboardDismissDisabled>
          <Dialog id="locked">
            <Heading slot="title">Locked</Heading>
            <Button id="locked-close" slot="close">
              Done
            </Button>
          </Dialog>
        </Modal>
      </DialogTrigger>
      <DialogTrigger>
        <Button id="filtered-trigger">Filtered</Button>
        <Modal isDismissable shouldCloseOnInteractOutside={(element: Element) => !element.closest(".rv-ModalOverlay")}>
          <Dialog id="filtered">
            <Heading slot="title">Filtered</Heading>
            <p>Clicks on the underlay keep it open (the page under it is inert).</p>
          </Dialog>
        </Modal>
      </DialogTrigger>
      {/* First open after resume enters (data-entering until onEnter's promise settles). */}
      <DialogTrigger>
        <Button id="animated-trigger">Animated</Button>
        <ModalOverlay id="animated-overlay" isDismissable onEnter={() => new Promise<void>((resolve) => setTimeout(resolve, 400))}>
          <Modal>
            <Dialog id="animated" aria-label="Animated">
              <p>Animated</p>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
      <Button id="open-controlled" onPress={() => controlled.set(true)}>
        Open controlled
      </Button>
      <Modal isOpen={controlled} onOpenChange={(open: boolean) => controlled.set(open)} isDismissable>
        <Dialog id="controlled" aria-label="Controlled">
          <p>A modal</p>
        </Dialog>
      </Modal>
      {/* A Modal outside the menu that opens it (docs example modal-controlled, bug D3-3). */}
      <MenuTrigger>
        <Button id="menu-modal-trigger">Menu</Button>
        <Popover>
          <Menu id="menu-modal-menu" aria-label="Actions">
            <MenuItem id="open" onAction={() => fromMenu.set(true)}>
              Open dialog…
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <Modal isDismissable isOpen={fromMenu}>
        <Dialog id="menu-modal" aria-label="From menu">
          <Button id="menu-modal-close" slot="close">
            Close
          </Button>
        </Dialog>
      </Modal>
      <p id="menu-modal-state">{fromMenu() ? "open" : "closed"}</p>
      <p id="modal-value">
        changes={changes()} controlled={controlled() ? "open" : "closed"}
      </p>
    </section>
  );
}
