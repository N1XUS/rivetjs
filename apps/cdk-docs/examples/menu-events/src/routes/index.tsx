import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Menu events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="e-trigger">Edit</Button>
        <Popover>
          {/* An inline arrow: the browser resumes it without loading the component. */}
          <Menu id="e" onAction={(key) => log.update((l) => [...l, String(key)])}>
            <MenuItem id="cut">Cut</MenuItem>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste" isDisabled>
              Paste
            </MenuItem>
            <MenuItem id="docs" href="#docs">
              Docs
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        onAction: <output id="e-log">{log().join(", ") || "none"}</output> (<output id="e-count">{log().length}</output>)
      </p>
    </section>
  );
}
// #endregion
