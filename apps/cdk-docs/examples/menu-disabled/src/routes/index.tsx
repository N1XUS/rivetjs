import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu disabled items" };

// #region demo
export default function Disabled() {
  const last = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="d-trigger">Edit</Button>
        <Popover>
          {/* disabledKeys on the menu, or isDisabled on one item. */}
          <Menu id="d" disabledKeys={["paste"]} onAction={(key) => last.set(key)}>
            <MenuItem id="cut">Cut</MenuItem>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
            <MenuItem id="delete" isDisabled>
              Delete
            </MenuItem>
            <MenuItem id="rename">Rename</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Last action: <output id="d-value">{last() ?? "nothing yet"}</output>
      </p>
    </section>
  );
}
// #endregion
