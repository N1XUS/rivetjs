import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Header } from "@rivetjs/cdk/header";
import { Menu, MenuItem, MenuSection, MenuTrigger, type Key, type Selection } from "@rivetjs/cdk/menu";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Menu section-level selection" };

const show = (s: Selection) => (s === "all" ? "all" : [...s].join(", ") || "none");

// #region demo
export default function SectionSelection() {
  const last = signal<Key | null>(null);
  const style = signal<Selection>(new Set(["bold"]));
  const align = signal<Selection>(new Set(["left"]));
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <MenuTrigger>
        <Button id="ss-trigger">Edit</Button>
        <Popover>
          <Menu id="ss" onAction={(key) => last.set(key)}>
            {/* No selection here: plain actions. */}
            <MenuSection id="clipboard">
              <Header>Clipboard</Header>
              <MenuItem id="cut">Cut</MenuItem>
              <MenuItem id="copy">Copy</MenuItem>
            </MenuSection>
            {/* Each section keeps its own selection state. */}
            <MenuSection id="style" selectionMode="multiple" selectedKeys={style}>
              <Header>Text style</Header>
              <MenuItem id="bold" textValue="Bold" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Bold
                  </>
                )}
              </MenuItem>
              <MenuItem id="italic" textValue="Italic" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Italic
                  </>
                )}
              </MenuItem>
            </MenuSection>
            <MenuSection id="align" selectionMode="single" selectedKeys={align}>
              <Header>Text alignment</Header>
              <MenuItem id="left" textValue="Left" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Left
                  </>
                )}
              </MenuItem>
              <MenuItem id="center" textValue="Center" class="flex items-center gap-2">
                {({ isSelected }) => (
                  <>
                    <span class="w-4">{isSelected() ? <Icon icon={Check} class="check" /> : null}</span>
                    Center
                  </>
                )}
              </MenuItem>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Action: <output id="ss-action">{last() ?? "none"}</output>
      </p>
      <p>
        Style: <output id="ss-style">{show(style())}</output>
      </p>
      <p>
        Alignment: <output id="ss-align">{show(align())}</output>
      </p>
    </section>
  );
}
// #endregion
