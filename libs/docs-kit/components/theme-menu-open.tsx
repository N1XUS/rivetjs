// The live theme menu (RT-DIET2 DOCS-CHROME): fetched by the docs page script (`page-script.ts`) when the pointer or
// focus reaches the static `ThemeMenu` button, mounted in its place on activation, open (the cdk `MenuTrigger` + `Popover`
// + single-select `Menu` on the div overlay layer: keyboard, focus restore, outside press, Escape).
import { signal } from "@rivetjs/reactivity";
import { mount } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Selection } from "@rivetjs/cdk/menu";
import { Check, Monitor, Moon, Sun } from "lucide";
import { Icon } from "@rivetjs/kit/icon";
import { applyPref, currentPref, type ThemePref } from "./browser.ts";
import { themeIcons, type ThemeMenuPlacement } from "./ThemeMenu.tsx";
import { replayPress } from "./chrome-press.ts";

const first = (keys: Selection): ThemePref | undefined => (keys === "all" ? undefined : ([...keys][0] as ThemePref | undefined));

/**
 * The live theme menu on the cdk Menu (div overlay layer), mounted by `theme-menu-open.tsx`. The selection is read from
 * the document when the menu opens (the server cannot know it).
 */
function ThemeMenuLive({ placement }: { placement: ThemeMenuPlacement }) {
  const choice = signal<Selection>(new Set([currentPref()]));
  return (
    <MenuTrigger
      onOpenChange={(isOpen) => {
        if (isOpen) choice.set(new Set([currentPref()]));
      }}
    >
      <Button class="top-icon theme-button" aria-label="Theme">
        {themeIcons()}
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

const swapped = new WeakMap<HTMLButtonElement, HTMLButtonElement>();

/**
 * Replace the static button by the live menu (closed; same markup): on the pointer reaching it or its focus, so the press
 * itself is the cdk trigger's (mouse / touch / keyboard alike). A focused static button hands its focus over.
 */
export function liveThemeMenu(button: HTMLButtonElement): HTMLButtonElement {
  let live = swapped.get(button);
  if (live) return live;
  const placement = (button.dataset.menuPlacement as ThemeMenuPlacement | undefined) ?? "bottom end";
  const fragment = document.createDocumentFragment();
  mount(() => <ThemeMenuLive placement={placement} />, fragment);
  live = fragment.querySelector("button")!;
  swapped.set(button, live);
  const focused = document.activeElement === button;
  button.replaceWith(fragment);
  if (focused) live.focus();
  return live;
}

/**
 * An activation of the static button that came before its module (a press faster than the fetch, a touch): the live
 * button, focused, gets it again — a `click` (virtual press) or the ArrowDown / ArrowUp `keydown` — and the cdk trigger
 * opens the menu as it would have (focus restored to that button on close).
 */
export function openThemeMenu(button: HTMLButtonElement, activation: Event): void {
  const live = liveThemeMenu(button);
  live.focus();
  if (activation instanceof KeyboardEvent) live.dispatchEvent(new KeyboardEvent("keydown", activation));
  else replayPress(live, activation as MouseEvent);
}
