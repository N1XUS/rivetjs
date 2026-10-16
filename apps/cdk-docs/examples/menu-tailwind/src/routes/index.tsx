import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Menu with Tailwind" };

const item = "rounded px-2 py-1 text-left outline-none focused:bg-teal-600 focused:text-white data-disabled:cursor-default data-disabled:opacity-40";

// #region demo
export default function Tailwind() {
  return (
    <section class="m-4 text-sm">
      <MenuTrigger>
        <Button
          id="tw-trigger"
          class="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-50 aria-expanded:bg-slate-100 focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          Message
        </Button>
        {/* entering: / exiting: style the first and last frame; the transition runs between them. */}
        <Popover class="tw-popover rounded-lg border border-slate-200 bg-white shadow-lg transition duration-150 entering:opacity-0 exiting:opacity-0 placement-bottom:mt-1 placement-bottom:entering:-translate-y-1 placement-top:mb-1 placement-top:entering:translate-y-1">
          <Menu id="tw" class="grid min-w-40 p-1 outline-none">
            <MenuItem id="archive" class={item}>
              Archive
            </MenuItem>
            <MenuItem id="move" class={item}>
              Move to…
            </MenuItem>
            <MenuItem id="delete" class={item} isDisabled>
              Delete
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </section>
  );
}
// #endregion
