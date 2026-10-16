import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Dialog } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { Modal } from "@rivetjs/cdk/modal";
import { Popover } from "@rivetjs/cdk/popover";

export const head = { title: "Controlled modal" };

// #region demo
export default function Controlled() {
  const isOpen = signal(false);
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="mc-menu-trigger">Menu</Button>
        <Popover>
          <Menu id="mc-menu" aria-label="Actions">
            {/* The modal lives outside the menu: the item opens it through the signal. */}
            <MenuItem id="open" onAction={() => isOpen.set(true)}>
              Open dialog…
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      {/* isOpen is two-way: the modal writes false when Escape or an outside press closes it. */}
      <Modal isDismissable isOpen={isOpen}>
        <Dialog id="mc-dialog">
          <Heading slot="title" class="m-0 text-base font-semibold">
            Notice
          </Heading>
          <p>Click outside or press Escape to close this dialog.</p>
          <Button id="mc-close" slot="close">
            Close
          </Button>
        </Dialog>
      </Modal>
      <p id="mc-state">{isOpen() ? "open" : "closed"}</p>
    </section>
  );
}
// #endregion
