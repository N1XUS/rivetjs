// Type-level suite (`tsc -p libs/ui` only): `Dropdown` / `Menu` props (cdk MenuTrigger / Menu / MenuItem props + variants +
// `class`), indicator `type`, accessor render props, compound statics.
import type { Selection } from "@rivetjs/cdk/menu";
import { signal } from "@rivetjs/reactivity";
import { Copy } from "lucide";
import { Dropdown } from "../src/components/dropdown/index.ts";
import { Menu } from "../src/components/menu/index.ts";

const sel = signal<Selection>(new Set());

export const dropdown = () => (
  <Dropdown trigger="longPress" onOpenChange={(open) => void open}>
    <Dropdown.Trigger class="x">Open</Dropdown.Trigger>
    <Dropdown.Popover placement="bottom end" class="p">
      <Dropdown.Menu aria-label="m" selectionMode="multiple" selectedKeys={sel} onAction={(k) => void k}>
        <Dropdown.Section>
          <Dropdown.Item id="a" textValue="A" variant="danger">
            <Dropdown.ItemIndicator type="dot" />
            {"A"}
          </Dropdown.Item>
        </Dropdown.Section>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item id="b">
            B
            <Dropdown.SubmenuIndicator />
          </Dropdown.Item>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label="sub">
              <Dropdown.Item id="c">
                <Dropdown.ItemIndicator>{({ isSelected }) => (isSelected() ? "on" : null)}</Dropdown.ItemIndicator>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.SubmenuTrigger>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
);

export const menu = () => (
  <Menu aria-label="m">
    <Menu.Item id="a">A</Menu.Item>
  </Menu>
);

const dp: Dropdown["Props"] = { defaultOpen: true };
const mp: Menu["Props"] = { "aria-label": "x" };
void dp;
void mp;

// @ts-expect-error bad indicator type
export const badType = () => <Dropdown.ItemIndicator type="star" />;
// @ts-expect-error bad variant
export const badVariant = () => <Menu.Item variant="loud">x</Menu.Item>;

// Rivet fold: Menu takes the popover placement props and wraps itself; item icon / description / shortcut sugar.
export const folded = () => (
  <Dropdown>
    <Dropdown.Trigger>Open</Dropdown.Trigger>
    <Dropdown.Menu aria-label="m" placement="bottom end" offset={4} shouldFlip={false}>
      <Dropdown.Item id="a" icon={Copy} description="Copy the link" shortcut="command+C">
        Copy
      </Dropdown.Item>
      <Dropdown.Item id="b" shortcut={<kbd>B</kbd>}>
        B
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
);
// @ts-expect-error icon takes lucide icon data, not a string
export const badIcon = () => <Dropdown.Item icon="copy">x</Dropdown.Item>;
