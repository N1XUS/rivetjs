import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";

export const head = { title: "Menu" };

export default function MenuStory() {
  const last = signal("none");
  const count = signal(0);
  const onAction = (key: Key) => {
    last.set(String(key));
    count.update((n) => n + 1);
  };
  return (
    <section>
      <h1>Menu</h1>
      <MenuTrigger>
        <Button id="edit-trigger">Edit</Button>
        <Popover>
          <Menu id="edit" onAction={onAction}>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
            <MenuItem id="delete" isDisabled>
              Delete
            </MenuItem>
            <MenuItem id="rename">Rename</MenuItem>
            <MenuItem id="docs" href="/">
              Docs
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p id="menu-value">
        Last action: {last()} ({count()})
      </p>
      <div class="spacer"></div>
    </section>
  );
}
