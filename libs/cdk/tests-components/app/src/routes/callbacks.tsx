import { signal } from "@rivetjs/reactivity";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";
import { Popover } from "@rivetjs/cdk/popover";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Callbacks" };

// Fragment root, a const arrow and inline arrows as callback props (G26: K5 + R2).
export default function Callbacks() {
  const last = signal("none");
  const presses = signal(0);
  const onAction = (key: Key) => last.set(String(key));
  return (
    <>
      <h1>Callbacks</h1>
      <MenuTrigger>
        <Button id="cb-menu-trigger">Edit</Button>
        <Popover>
          <Menu onAction={onAction}>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <MenuTrigger>
        <Button id="cb-inline-trigger">More</Button>
        <Popover>
          <Menu onAction={(key: Key) => last.set("inline " + String(key))}>
            <MenuItem id="cut">Cut</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <Button id="cb-press" onPress={() => presses.update((n) => n + 1)}>
        Press
      </Button>
      <p id="cb-value">
        {last()} / {presses()}
      </p>
    </>
  );
}
