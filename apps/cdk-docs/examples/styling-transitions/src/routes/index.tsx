import { signal } from "@rivetjs/reactivity";
import { Popover } from "@rivetjs/cdk/popover";
import { Button } from "@rivetjs/cdk/button";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { Heading } from "@rivetjs/cdk/heading";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Overlay transitions" };

const button = "rounded-md border border-slate-300 px-3 py-1.5 aria-expanded:bg-slate-100";
const item = "block w-full rounded px-3 py-1 text-left outline-none focus-visible:bg-slate-100";

// #region demo
export default function Overlays() {
  const last = signal("none");
  return (
    <section class="m-4 flex items-start gap-3 text-sm">
      {/* Variants on the popover's data-entering / data-exiting, CSS transitions (starting style while entering). */}
      <DialogTrigger>
        <Button id="info-trigger" class={button}>
          Info
        </Button>
        <Popover
          placement="bottom start"
          offset={6}
          class="w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg outline-none transition duration-150 ease-out entering:scale-95 entering:opacity-0 exiting:scale-95 exiting:opacity-0 exiting:duration-100 exiting:ease-in"
        >
          <Dialog id="info" class="outline-none">
            <Heading slot="title" class="m-0 text-sm font-semibold">
              Shipping
            </Heading>
            <p>Orders ship within two days.</p>
          </Dialog>
        </Popover>
      </DialogTrigger>
      {/* The same variants with CSS animations (keyframes in styles.css). */}
      <MenuTrigger>
        <Button id="actions-trigger" class={button}>
          Actions
        </Button>
        <Popover class="actions-popover rounded-lg border border-slate-200 bg-white p-1 shadow-lg entering:animate-menu-in exiting:animate-menu-out placement-top:origin-bottom">
          <Menu id="actions" onAction={(key) => last.set(String(key))}>
            <MenuItem id="rename" class={item}>
              Rename
            </MenuItem>
            <MenuItem id="duplicate" class={item}>
              Duplicate
            </MenuItem>
            <MenuItem id="delete" class={item}>
              Delete
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p id="value" class="text-slate-600">
        Last action: {last()}
      </p>
    </section>
  );
}
// #endregion
