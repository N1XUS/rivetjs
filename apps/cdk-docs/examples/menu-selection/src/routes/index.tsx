import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger, type Selection } from "@rivetjs/cdk/menu";
import { Check, Dot } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Menu selection" };

const show = (s: Selection) => (s === "all" ? "all" : [...s].join(", ") || "none");

// #region demo
export default function SelectionDemo() {
  // A Signal as selectedKeys: two-way (the menu writes it, your code reads and resets it).
  const view = signal<Selection>(new Set(["rulers"]));
  const align = signal<Selection>(new Set(["left"]));
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <div class="flex gap-2">
        <MenuTrigger>
          <Button id="sel-view-trigger">View</Button>
          <Popover>
            {/* multiple: items are menuitemcheckbox; the menu stays open after each toggle. */}
            <Menu id="sel-view" selectionMode="multiple" selectedKeys={view}>
              <MenuItem id="grid" textValue="Pixel grid" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Pixel grid
                  </>
                )}
              </MenuItem>
              <MenuItem id="rulers" textValue="Rulers" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Rulers
                  </>
                )}
              </MenuItem>
              <MenuItem id="layout" textValue="Layout guides" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Layout guides
                  </>
                )}
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <MenuTrigger>
          <Button id="sel-align-trigger">Align</Button>
          <Popover>
            {/* single: items are menuitemradio; selecting closes the menu. */}
            <Menu id="sel-align" selectionMode="single" selectedKeys={align}>
              <MenuItem id="left" textValue="Left" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Dot} class="dot" strokeWidth={6} /> : null}</span>
                    Left
                  </>
                )}
              </MenuItem>
              <MenuItem id="center" textValue="Center" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Dot} class="dot" strokeWidth={6} /> : null}</span>
                    Center
                  </>
                )}
              </MenuItem>
              <MenuItem id="right" textValue="Right" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Dot} class="dot" strokeWidth={6} /> : null}</span>
                    Right
                  </>
                )}
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
      <p>
        View: <output id="sel-view-value">{show(view())}</output>
      </p>
      <p>
        Align: <output id="sel-align-value">{show(align())}</output>
      </p>
      <button type="button" id="sel-reset" class="rv-Button" onClick={() => view.set(new Set())}>
        Clear view
      </button>
    </section>
  );
}
// #endregion
