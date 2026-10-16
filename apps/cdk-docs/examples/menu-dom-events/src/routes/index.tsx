import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu DOM events and attributes" };

// #region demo
export default function DomEvents() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const action = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-md justify-items-start gap-3 text-sm">
      <MenuTrigger>
        {/* Each part takes its own global DOM events and attributes. */}
        <Button id="d-trigger" lang="en" onPointerEnter={() => add("trigger-enter")} onClick={() => add("trigger-click")}>
          Actions
        </Button>
        <Popover>
          <Menu id="d" lang="pt" dir="ltr" onPointerEnter={() => add("menu-enter")} onClick={() => add("menu-click")} onAction={(key) => action.set(key)}>
            <MenuItem id="copy" onPointerDown={() => add("copy-down")}>
              Copy
            </MenuItem>
            <MenuItem id="paste" lang="nl">
              Paste
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Action: <output id="d-action">{String(action())}</output>
      </p>
      <p>
        Log: <output id="d-log">{log().join(" ")}</output>
      </p>
    </section>
  );
}
// #endregion
