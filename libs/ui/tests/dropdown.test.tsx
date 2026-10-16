// DOM-target suite: `Dropdown` + `Menu` (upstream tests/components/{dropdown,menu}/*.test.tsx ported to happy-dom): trigger
// `data-slot`, open → `dropdown-menu` / `dropdown-popover` slots + 3 items, press an item → `onAction` key + menu closed, keyboard
// (Enter on the trigger, arrows, Enter), Escape without selecting, Menu inside a cdk MenuTrigger (`data-slot=menu`, `.menu`,
// `menu-item`), `Menu.Section` + Header; handing off to a Modal / AlertDialog (popover gone, dialog open). Rivet: part classes in /
// outside a Dropdown, `SurfaceContext` in the popover, indicators (checkmark offset, dot, `data-visible`), submenu indicator only on
// a submenu trigger item, `variant="danger"`, `data-selection-mode`, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
// No global `CSS` here (happy-dom sets it on the window only): cdk collections fall back to their own `cssEscape`.
assert.equal((globalThis as Record<string, unknown>).CSS, undefined);

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { MenuTrigger } = await import("@rivetjs/cdk/menu");
const { Popover: CdkPopover } = await import("@rivetjs/cdk/popover");
const { Button } = await import("../src/components/button/index.ts");
const { Header } = await import("../src/components/header/index.ts");
const { Label } = await import("../src/components/label/index.ts");
const { Modal } = await import("../src/components/modal/index.ts");
const { AlertDialog } = await import("../src/components/alert-dialog/index.ts");
const { SurfaceContext } = await import("../src/components/surface/index.ts");
const D = await import("../src/components/dropdown/index.ts");
const M = await import("../src/components/menu/index.ts");
const MI = await import("../src/components/menu-item/index.ts");
const MS = await import("../src/components/menu-section/index.ts");
const { Dropdown } = D;
const { Menu } = M;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const key = (el: Element, k: string) => {
  el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  el.dispatchEvent(new W.KeyboardEvent("keyup", { key: k, bubbles: true, cancelable: true }));
};
const menu = () => document.querySelector("[role=menu]") as HTMLElement | null;
const items = () => [...document.querySelectorAll("[role^=menuitem]")] as HTMLElement[];
const item = (text: string) => items().find((i) => i.textContent!.includes(text))!;

const Fixture = (props: { defaultOpen?: boolean; onAction?: (k: unknown) => void }) => (
  <Dropdown defaultOpen={props.defaultOpen}>
    <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
    <Dropdown.Popover>
      <Dropdown.Menu onAction={props.onAction as never}>
        <Dropdown.Item id="new-file" textValue="New file">
          <Label>New file</Label>
        </Dropdown.Item>
        <Dropdown.Item id="copy-link" textValue="Copy link">
          <Label>Copy link</Label>
        </Dropdown.Item>
        <Dropdown.Item id="delete-file" textValue="Delete file">
          <Label>Delete file</Label>
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>
);

test("dropdown: index exports", () => {
  assert.equal(Dropdown, D.DropdownRoot);
  assert.equal(Dropdown.Trigger, D.DropdownTrigger);
  assert.equal(Dropdown.Popover, D.DropdownPopover);
  assert.equal(Dropdown.Menu, D.DropdownMenu);
  assert.equal(Dropdown.SubmenuTrigger, D.DropdownSubmenuTrigger);
  assert.equal(Menu, M.MenuRoot);
  assert.equal(Menu.Item, MI.MenuItem);
  assert.equal(Menu.ItemIndicator, MI.MenuItemIndicator);
  assert.equal(Menu.Section, MS.MenuSection);
  assert.equal(MI.MenuItem.SubmenuIndicator, MI.MenuItemSubmenuIndicator);
  assert.equal(D.dropdownVariants().popover(), "dropdown__popover");
  assert.equal(M.menuVariants(), "menu");
  assert.equal(MI.menuItemVariants({ variant: "danger" }).item(), "menu-item menu-item--danger");
  assert.equal(MS.menuSectionVariants(), "menu-section");
});

test("dropdown (upstream): exposes trigger data-slot when using Dropdown.Trigger", () => {
  const r = render(() => <Fixture />);
  const trigger = document.querySelector('[data-slot="dropdown-trigger"]')!;
  assert.ok(trigger);
  assert.equal(trigger.className, "dropdown__trigger");
  r.unmount();
});

test("dropdown (upstream): open and select via press", async () => {
  const actions: unknown[] = [];
  const r = render(() => <Fixture onAction={(k) => actions.push(k)} />);
  assert.equal(menu(), null);
  press(r.container.querySelector("button")!);
  await flush();
  const m = menu()!;
  assert.ok(m);
  assert.equal(m.getAttribute("data-slot"), "dropdown-menu");
  assert.equal(m.className, "dropdown__menu");
  const pop = document.querySelector('[data-slot="dropdown-popover"]')!;
  assert.ok(pop);
  assert.match(pop.className, /dropdown__popover/);
  assert.equal(items().length, 3);
  assert.equal(items()[0]!.getAttribute("data-slot"), "menu-item");
  assert.equal(items()[0]!.className, "menu-item menu-item--default");
  press(item("Copy link"));
  await flush();
  assert.deepEqual(actions, ["copy-link"]);
  await flush();
  assert.equal(menu(), null);
  r.unmount();
});

test("dropdown (upstream): open and select via keyboard", async () => {
  const actions: unknown[] = [];
  const r = render(() => <Fixture onAction={(k) => actions.push(k)} />);
  const trigger = r.container.querySelector("button")!;
  trigger.focus();
  key(trigger, "Enter");
  await flush();
  assert.ok(menu());
  const del = item("Delete file");
  del.focus();
  key(del, "Enter");
  await flush();
  assert.deepEqual(actions, ["delete-file"]);
  await flush();
  assert.equal(menu(), null);
  r.unmount();
});

test("dropdown (upstream): Escape dismisses without selecting", async () => {
  const actions: unknown[] = [];
  const r = render(() => <Fixture defaultOpen onAction={(k) => actions.push(k)} />);
  await flush();
  assert.ok(menu());
  key(menu()!, "Escape");
  await flush();
  await flush();
  assert.equal(menu(), null);
  assert.deepEqual(actions, []);
  r.unmount();
});

test("dropdown (upstream): opening a Modal from an item leaves no popover behind", async () => {
  const open = signal(false);
  const r = render(() => (
    <>
      <Dropdown>
        <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu onAction={() => open.set(true)}>
            <Dropdown.Item id="open">Open modal</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Modal isOpen={open}>
        <Button>Open modal directly</Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Modal from dropdown</Modal.Heading>
              </Modal.Header>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  ));
  press(r.container.querySelector('[data-slot="dropdown-trigger"]')!);
  await flush();
  press(item("Open modal"));
  await flush();
  await flush();
  assert.equal(menu(), null);
  assert.equal(document.querySelector('[data-slot="dropdown-popover"]'), null);
  assert.ok([...document.querySelectorAll("[role=dialog]")].some((d) => d.textContent!.includes("Modal from dropdown")));
  r.unmount();
});

test("dropdown (upstream): closing a controlled dropdown while opening an AlertDialog", async () => {
  const menuOpen = signal(false);
  const open = signal(false);
  const r = render(() => (
    <>
      <Dropdown isOpen={menuOpen}>
        <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={() => {
              menuOpen.set(false);
              open.set(true);
            }}
          >
            <Dropdown.Item id="delete">Delete project</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <AlertDialog isOpen={open}>
        <Button>Delete project directly</Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>Delete project permanently?</AlertDialog.Heading>
              </AlertDialog.Header>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  ));
  press(r.container.querySelector('[data-slot="dropdown-trigger"]')!);
  await flush();
  press(item("Delete project"));
  await flush();
  await flush();
  await flush();
  assert.equal(menu(), null);
  assert.equal(document.querySelector('[data-slot="dropdown-popover"]'), null);
  assert.ok(document.querySelector("[role=alertdialog]"));
  assert.equal(menuOpen(), false);
  r.unmount();
});

test("menu (upstream): menu data-slot, class, items; onAction; Escape", async () => {
  const actions: unknown[] = [];
  const r = render(() => (
    <MenuTrigger>
      <Button aria-label="Menu">Actions</Button>
      <CdkPopover>
        <Menu onAction={(k) => actions.push(k)}>
          <Menu.Item id="new-file" textValue="New file">
            <Label>New file</Label>
          </Menu.Item>
          <Menu.Item id="copy-link" textValue="Copy link">
            <Label>Copy link</Label>
          </Menu.Item>
          <Menu.Item id="delete-file" textValue="Delete file">
            <Label>Delete file</Label>
          </Menu.Item>
        </Menu>
      </CdkPopover>
    </MenuTrigger>
  ));
  assert.equal(menu(), null);
  press(r.container.querySelector("button")!);
  await flush();
  const m = menu()!;
  assert.equal(m.getAttribute("data-slot"), "menu");
  assert.match(m.className, /\bmenu\b/);
  assert.ok(document.querySelector('[data-slot="menu-item"]'));
  assert.equal(items().length, 3);
  press(item("Copy link"));
  await flush();
  await flush();
  assert.deepEqual(actions, ["copy-link"]);
  assert.equal(menu(), null);
  press(r.container.querySelector("button")!);
  await flush();
  key(menu()!, "Escape");
  await flush();
  await flush();
  assert.equal(menu(), null);
  assert.deepEqual(actions, ["copy-link"]);
  r.unmount();
});

test("menu (upstream): Menu.Section with Header and item action", async () => {
  const actions: unknown[] = [];
  const r = render(() => (
    <MenuTrigger defaultOpen>
      <Button aria-label="Menu">Actions</Button>
      <CdkPopover>
        <Menu onAction={(k) => actions.push(k)}>
          <Menu.Section>
            <Header>File</Header>
            <Menu.Item id="new-file" textValue="New file">
              <Label>New file</Label>
            </Menu.Item>
            <Menu.Item id="copy-link" textValue="Copy link">
              <Label>Copy link</Label>
            </Menu.Item>
          </Menu.Section>
        </Menu>
      </CdkPopover>
    </MenuTrigger>
  ));
  await flush();
  assert.ok(document.body.textContent!.includes("File"));
  assert.ok(document.querySelector(".menu-section"));
  press(item("Copy link"));
  await flush();
  assert.deepEqual(actions, ["copy-link"]);
  r.unmount();
});

test("dropdown: indicators follow selection; dot type; danger variant; data-selection-mode", async () => {
  const sel = signal<"all" | Set<string | number>>(new Set(["a"]));
  const r = render(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>Open</Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="m" selectionMode="single" selectedKeys={sel as never}>
          <Dropdown.Item id="a" textValue="A">
            <Dropdown.ItemIndicator />
            <Label>A</Label>
          </Dropdown.Item>
          <Dropdown.Item id="b" textValue="B" variant="danger">
            <Dropdown.ItemIndicator type="dot" />
            <Label>B</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  ));
  await flush();
  assert.equal(menu()!.getAttribute("data-selection-mode"), "single");
  const [a, b] = items();
  assert.equal(a!.getAttribute("role"), "menuitemradio");
  assert.equal(b!.className, "menu-item menu-item--danger");
  const ia = a!.querySelector('[data-slot="menu-item-indicator"]')!;
  assert.equal(ia.className, "menu-item__indicator");
  assert.equal(ia.getAttribute("aria-hidden"), "true");
  assert.equal(ia.getAttribute("data-type"), "checkmark");
  assert.equal(ia.getAttribute("data-visible"), "true");
  assert.equal(ia.querySelector('[data-slot="menu-item-indicator--checkmark"]')!.getAttribute("stroke-dashoffset"), "48");
  const ib = b!.querySelector('[data-slot="menu-item-indicator"]')!;
  assert.equal(ib.getAttribute("data-type"), "dot");
  assert.equal(ib.getAttribute("data-visible"), null);
  assert.ok(ib.querySelector('[data-slot="menu-item-indicator--dot"]'));
  sel.set(new Set(["b"]));
  await flush();
  assert.equal(ia.getAttribute("data-visible"), null);
  assert.equal(a!.querySelector('[data-slot="menu-item-indicator--checkmark"]')!.getAttribute("stroke-dashoffset"), "72");
  assert.equal(ib.getAttribute("data-visible"), "true");
  r.unmount();
});

test("dropdown: submenu indicator only on a submenu trigger item; SurfaceContext in the popover; render-function indicator", async () => {
  let surface: unknown;
  const Probe = () => {
    surface = useContext(SurfaceContext);
    return null;
  };
  const r = render(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>Open</Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu aria-label="m" selectionMode="multiple">
          <Dropdown.Item id="plain" textValue="Plain">
            <Probe />
            <Label>Plain</Label>
            <Dropdown.SubmenuIndicator />
            <Dropdown.ItemIndicator>{({ isSelected }) => (isSelected() ? "on" : "off")}</Dropdown.ItemIndicator>
          </Dropdown.Item>
          <Dropdown.SubmenuTrigger>
            <Dropdown.Item id="share" textValue="Share">
              <Label>Share</Label>
              <Dropdown.SubmenuIndicator />
            </Dropdown.Item>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="sub">
                <Dropdown.Item id="mail">Mail</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown.SubmenuTrigger>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  ));
  await flush();
  assert.deepEqual(surface, { variant: "default" });
  const plain = item("Plain");
  const share = item("Share");
  assert.equal(plain.querySelector('[data-slot="submenu-indicator"]'), null);
  const si = share.querySelector('[data-slot="submenu-indicator"]')!;
  assert.ok(si);
  assert.equal(si.className, "menu-item__indicator menu-item__indicator--submenu");
  assert.ok(si.querySelector("svg"));
  assert.equal(share.getAttribute("aria-haspopup"), "menu");
  assert.equal(plain.querySelector('[data-slot="menu-item-indicator"]')!.textContent, "off");
  press(plain);
  await flush();
  assert.equal(plain.querySelector('[data-slot="menu-item-indicator"]')!.textContent, "on");
  r.unmount();
});

test("dropdown: parts outside a Dropdown get only the caller's class", async () => {
  const r = render(() => (
    <MenuTrigger defaultOpen>
      <Dropdown.Trigger class="t">Open</Dropdown.Trigger>
      <Dropdown.Popover class="p">
        <Dropdown.Menu aria-label="m" class="m">
          <Dropdown.Item id="x">X</Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </MenuTrigger>
  ));
  await flush();
  assert.equal(r.container.querySelector('[data-slot="dropdown-trigger"]')!.className, "t");
  assert.equal(document.querySelector('[data-slot="dropdown-popover"]')!.className, "p");
  assert.equal(menu()!.className, "m");
  r.unmount();
});

// Rivet fold + item sugar (identity T18).
const maskIds = (html: string) => html.replace(/ (id|aria-labelledby|aria-describedby|aria-controls|data-rv-focus-scope|data-collection)="[^"]*"/g, "");
const { Copy } = await import("lucide");

test("dropdown fold: a Menu without Dropdown.Popover renders the same popover; string items = Label + textValue", async () => {
  const explicit = render(() => <Fixture defaultOpen />);
  await flush();
  const before = maskIds(document.querySelector('[data-slot="dropdown-popover"]')!.outerHTML);
  explicit.unmount();
  const folded = render(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger aria-label="Menu">Actions</Dropdown.Trigger>
      <Dropdown.Menu>
        <Dropdown.Item id="new-file">New file</Dropdown.Item>
        <Dropdown.Item id="copy-link">Copy link</Dropdown.Item>
        <Dropdown.Item id="delete-file">Delete file</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  ));
  await flush();
  assert.equal(document.querySelectorAll('[data-slot="dropdown-popover"]').length, 1);
  assert.equal(maskIds(document.querySelector('[data-slot="dropdown-popover"]')!.outerHTML), before);
  folded.unmount();
});

test("dropdown fold: placement on the Menu; a submenu Menu without a Popover gets its own", async () => {
  const actions: unknown[] = [];
  const r = render(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>Open</Dropdown.Trigger>
      <Dropdown.Menu aria-label="m" placement="bottom end" onAction={(k) => actions.push(k)}>
        <Dropdown.Item id="plain">Plain</Dropdown.Item>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item id="share">
            <Label>Share</Label>
            <Dropdown.SubmenuIndicator />
          </Dropdown.Item>
          <Dropdown.Menu aria-label="sub" onAction={(k) => actions.push(k)}>
            <Dropdown.Item id="mail">Mail</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.SubmenuTrigger>
      </Dropdown.Menu>
    </Dropdown>
  ));
  await flush();
  const pops = () => document.querySelectorAll('[data-slot="dropdown-popover"]');
  assert.equal(pops().length, 1);
  assert.equal(pops()[0]!.getAttribute("data-placement")?.startsWith("bottom"), true);
  press(item("Share"));
  await flush();
  assert.equal(pops().length, 2);
  assert.equal(document.querySelectorAll("[role=menu]").length, 2);
  assert.equal(pops()[1]!.getAttribute("data-trigger"), "SubmenuTrigger");
  assert.equal(pops()[1]!.getAttribute("data-placement"), "right");
  press(item("Mail"));
  await flush();
  assert.deepEqual(actions, ["mail"]);
  r.unmount();
});

test("dropdown item sugar: icon, description, shortcut; danger icon colour class; typeahead text", async () => {
  const r = render(() => (
    <Dropdown defaultOpen>
      <Dropdown.Trigger>Open</Dropdown.Trigger>
      <Dropdown.Menu aria-label="m">
        <Dropdown.Item id="copy" icon={Copy} description="Copy the link" shortcut="command+shift+C">
          Copy link
        </Dropdown.Item>
        <Dropdown.Item id="del" variant="danger" icon={Copy} shortcut="Del">
          Delete
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  ));
  await flush();
  const copy = item("Copy link");
  const kids = [...copy.children].map((c) => c.getAttribute("class") ?? c.tagName);
  assert.equal(kids.length, 3);
  assert.match(kids[0]!, /menu-item__icon/);
  assert.equal(kids[1], "menu-item__text");
  assert.match(kids[2]!, /menu-item__shortcut/);
  assert.equal(copy.querySelector("svg.menu-item__icon")?.getAttribute("width"), "16");
  assert.equal(copy.querySelector('.menu-item__text [data-slot="label"]')!.textContent, "Copy link");
  assert.equal(copy.querySelector('.menu-item__text [data-slot="description"]')!.textContent, "Copy the link");
  const kbd = copy.querySelector(".menu-item__shortcut")!;
  assert.deepEqual(
    [...kbd.querySelectorAll("abbr")].map((a) => a.getAttribute("title")),
    ["Command", "Shift"],
  );
  assert.equal(kbd.textContent!.endsWith("C"), true);
  assert.equal(copy.getAttribute("aria-describedby"), copy.querySelector('[data-slot="description"]')!.id);
  assert.equal(copy.getAttribute("data-text"), "Copy link");
  const del = item("Delete");
  assert.equal(del.querySelector(".menu-item__shortcut abbr"), null);
  assert.equal(del.querySelector(".menu-item__shortcut")!.textContent, "Del");
  assert.match(del.className, /menu-item--danger/);
  r.unmount();
});
