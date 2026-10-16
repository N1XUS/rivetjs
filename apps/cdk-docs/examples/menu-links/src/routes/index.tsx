import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Menu with links" };

// #region demo
export default function Links() {
  const last = signal("none");
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="go-trigger">Go to</Button>
        <Popover>
          <Menu id="go" onAction={(key) => last.set(String(key))}>
            <MenuItem id="print">Print</MenuItem>
            {/* An href makes the item an <a role="menuitem">: it navigates (onAction still runs, like RAC). */}
            <MenuItem id="help" href="./help">
              Help
            </MenuItem>
            <MenuItem id="disabled-link" href="./archive" isDisabled>
              Archive
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p id="go-value">Last action: {last()}</p>
    </section>
  );
}
// #endregion
