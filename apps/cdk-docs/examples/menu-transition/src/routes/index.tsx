import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Menu transitions" };

const item = "block w-full rounded px-2 py-1 text-left outline-none focused:bg-slate-100";

// #region demo
export default function Transition() {
  return (
    <section class="m-4 text-sm">
      <MenuTrigger>
        <Button id="tr-trigger" class="rounded-md border border-slate-300 px-3 py-1.5">
          Options
        </Button>
        {/* data-entering / data-exiting (Tailwind entering: / exiting:) mark the first and last frame; the
            popover stays mounted until its exit transition ends. */}
        <Popover class="tr-popover mt-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg transition duration-200 ease-out entering:scale-95 entering:opacity-0 exiting:opacity-0 exiting:duration-300 exiting:ease-in">
          <Menu id="tr">
            <MenuItem id="one" class={item}>
              Duplicate
            </MenuItem>
            <MenuItem id="two" class={item}>
              Rename
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </section>
  );
}
// #endregion
