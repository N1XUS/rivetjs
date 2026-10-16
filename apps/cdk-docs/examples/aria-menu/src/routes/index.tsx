import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "MenuTrigger" };

// #region demo
export default function Editor() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="edit-trigger">Edit</Button>
        <Popover>
          <Menu id="edit" onAction={(key) => last.set(String(key))}>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
            <MenuItem id="delete" isDisabled>
              Delete
            </MenuItem>
            <MenuItem id="rename">Rename</MenuItem>
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
