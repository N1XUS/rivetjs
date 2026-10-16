import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu onAction into a signal" };

// #region demo
export default function Controlled() {
  // One signal, written by both menus' onAction (the last activated key wins).
  const action = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <div class="flex gap-2">
        <MenuTrigger>
          <Button id="c-file-trigger">File</Button>
          <Popover>
            <Menu id="c-file" onAction={(key) => action.set(key)}>
              <MenuItem id="open">Open</MenuItem>
              <MenuItem id="save">Save</MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <MenuTrigger>
          <Button id="c-view-trigger">View</Button>
          <Popover>
            <Menu id="c-view" onAction={(key) => action.set(key)}>
              <MenuItem id="zoom">Zoom in</MenuItem>
              <MenuItem id="full">Full screen</MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <p>
        Last action: <output id="c-value">{action() ?? "nothing yet"}</output>
      </p>
      <button type="button" id="c-reset" class="rv-Button" disabled={action() === null} onClick={() => action.set(null)}>
        Reset
      </button>
    </section>
  );
}
// #endregion
