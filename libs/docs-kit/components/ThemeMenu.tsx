import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Selection } from "@rivetjs/cdk/menu";
import { Check, Monitor, Moon, Sun } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { applyPref, currentPref, type ThemePref } from "./browser.ts";

const first = (keys: Selection): ThemePref | undefined => (keys === "all" ? undefined : ([...keys][0] as ThemePref | undefined));

/**
 * Theme menu (System / Light / Dark) on the cdk Menu (div overlay layer). The trigger shows the
 * current theme's icon (CSS on `data-theme`); the menu code loads when you point at the trigger.
 * The selection is read from the document when the menu opens (the server cannot know it).
 */
export function ThemeMenu({ placement = "bottom end" }: { placement?: "right bottom" | "bottom end" }) {
  const choice = signal<Selection>(new Set(["system"]));
  return (
    <MenuTrigger
      onOpenChange={(open) => {
        if (open) choice.set(new Set([currentPref()]));
      }}
    >
      <Button class="top-icon theme-button" aria-label="Theme">
        <Icon icon={Sun} size={19} strokeWidth={1.75} class="icon-light" />
        <Icon icon={Moon} size={19} strokeWidth={1.75} class="icon-dark" />
      </Button>
      <Popover placement={placement} class="menu-popover" offset={6}>
        <Menu
          class="menu"
          aria-label="Theme"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={choice}
          onSelectionChange={(keys) => {
            const pref = first(keys);
            if (pref) applyPref(pref);
          }}
        >
          <MenuItem id="system" textValue="System" class="menu-item">
            {({ isSelected }) => (
              <>
                <Icon icon={Monitor} size={16} />
                <span class="menu-item-label">System</span>
                <span class="menu-check">{isSelected() ? <Icon icon={Check} size={16} /> : null}</span>
              </>
            )}
          </MenuItem>
          <MenuItem id="light" textValue="Light" class="menu-item">
            {({ isSelected }) => (
              <>
                <Icon icon={Sun} size={16} />
                <span class="menu-item-label">Light</span>
                <span class="menu-check">{isSelected() ? <Icon icon={Check} size={16} /> : null}</span>
              </>
            )}
          </MenuItem>
          <MenuItem id="dark" textValue="Dark" class="menu-item">
            {({ isSelected }) => (
              <>
                <Icon icon={Moon} size={16} />
                <span class="menu-item-label">Dark</span>
                <span class="menu-check">{isSelected() ? <Icon icon={Check} size={16} /> : null}</span>
              </>
            )}
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
