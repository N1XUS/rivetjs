import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Text } from "@rivetjs/cdk/text";
import { Keyboard } from "@rivetjs/cdk/keyboard";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";
import { Ellipsis } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Menu item content" };

// #region demo
export default function Slots() {
  const last = signal<Key | null>(null);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        {/* An icon as the trigger content; aria-label names the button (and so the menu). */}
        <Button id="s-trigger" aria-label="More actions">
          <Icon icon={Ellipsis} />
        </Button>
        <Popover>
          <Menu id="s" onAction={(key) => last.set(key)}>
            {/* Text slots label / describe the item (aria-labelledby / aria-describedby); Keyboard = its shortcut. */}
            <MenuItem id="new" textValue="New" class="flex w-56 items-baseline gap-3">
              <span class="grid">
                <Text slot="label" class="font-medium">
                  New
                </Text>
                <Text slot="description" class="text-xs text-slate-500">
                  Start from scratch
                </Text>
              </span>
              <Keyboard class="ms-auto font-sans text-xs text-slate-500">Ctrl+N</Keyboard>
            </MenuItem>
            <MenuItem id="open" textValue="Open" class="flex w-56 items-baseline gap-3">
              <span class="grid">
                <Text slot="label" class="font-medium">
                  Open
                </Text>
                <Text slot="description" class="text-xs text-slate-500">
                  Pick a file
                </Text>
              </span>
              <Keyboard class="ms-auto font-sans text-xs text-slate-500">Ctrl+O</Keyboard>
            </MenuItem>
            <MenuItem id="save" textValue="Save" class="flex w-56 items-baseline gap-3">
              <span class="grid">
                <Text slot="label" class="font-medium">
                  Save
                </Text>
                <Text slot="description" class="text-xs text-slate-500">
                  Keep your changes
                </Text>
              </span>
              <Keyboard class="ms-auto font-sans text-xs text-slate-500">Ctrl+S</Keyboard>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Last action: <output id="s-value">{String(last())}</output>
      </p>
    </section>
  );
}
// #endregion
