// DOM-target suite (Rivet additions, feature sets inspired by HeroUI Pro's public docs, independent implementations):
// ContextMenu (right click on the trigger opens the menu with the dropdown surface, an action closes it and reports the key,
// isDisabled = no custom menu), Command (a Button opens the palette, the search field filters case- and accent-insensitively
// including `textValue` search terms, empty state, sizes / backdrop variants, Enter runs the focused command).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
const { render } = await import("@rivetjs/runtime/testing");
const { ContextMenu } = await import("../src/components/context-menu/index.ts");
const { Command } = await import("../src/components/command/index.ts");
const { Button } = await import("../src/components/button/index.ts");
const { signal } = await import("@rivetjs/reactivity");

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as {
  PointerEvent: typeof PointerEvent;
  MouseEvent: typeof MouseEvent;
  KeyboardEvent: typeof KeyboardEvent;
  InputEvent: typeof InputEvent;
};
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
function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new W.InputEvent("input", { bubbles: true }));
}
const items = () => [...document.querySelectorAll("[role^=menuitem]")] as HTMLElement[];
const cleanup = (r: { unmount?: () => void; dispose?: () => void }) => (r.unmount ?? r.dispose)?.();

test("context menu: right click opens at the pointer, action closes + reports the key", async () => {
  const actions: unknown[] = [];
  const r = render(() => (
    <ContextMenu>
      <ContextMenu.Trigger id="area">Right click here</ContextMenu.Trigger>
      <ContextMenu.Popover>
        <ContextMenu.Menu onAction={(k) => actions.push(k)}>
          <ContextMenu.Item id="copy">Copy</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item id="paste">Paste</ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu.Popover>
    </ContextMenu>
  ));
  const area = document.getElementById("area")!;
  assert.equal(area.getAttribute("data-slot"), "context-menu-trigger");
  assert.match(area.className, /context-menu__trigger/);
  assert.equal(document.querySelector("[role=menu]"), null);
  area.dispatchEvent(new W.MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 40, clientY: 30 }));
  await flush();
  const menu = document.querySelector("[role=menu]") as HTMLElement;
  assert.ok(menu, "menu open");
  assert.match(menu.className, /dropdown__menu context-menu__menu/);
  assert.match((document.querySelector("[data-slot=context-menu-popover]") as HTMLElement).className, /dropdown__popover context-menu__popover/);
  assert.equal(items().length, 2);
  assert.ok(document.querySelector(".context-menu__separator"));
  press(items()[1]!);
  await flush();
  assert.deepEqual(actions, ["paste"]);
  assert.equal(document.querySelector("[role=menu]"), null);
  cleanup(r as never);
});

test("context menu: isDisabled leaves the browser menu alone", async () => {
  const r = render(() => (
    <ContextMenu isDisabled>
      <ContextMenu.Trigger id="area2">Area</ContextMenu.Trigger>
      <ContextMenu.Popover>
        <ContextMenu.Menu>
          <ContextMenu.Item id="a">A</ContextMenu.Item>
        </ContextMenu.Menu>
      </ContextMenu.Popover>
    </ContextMenu>
  ));
  const area = document.getElementById("area2")!;
  assert.equal(area.getAttribute("data-disabled"), "true");
  const ev = new W.MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
  area.dispatchEvent(ev);
  await flush();
  assert.equal(ev.defaultPrevented, false);
  assert.equal(document.querySelector("[role=menu]"), null);
  cleanup(r as never);
});

const Palette = (props: {
  isOpen: ReturnType<typeof signal<boolean>>;
  onAction: (k: unknown) => void;
  size?: "sm" | "md" | "lg";
  variant?: "opaque" | "blur" | "transparent";
}) => (
  <Command isOpen={props.isOpen}>
    <Button id="open">Open</Button>
    <Command.Backdrop variant={props.variant}>
      <Command.Container size={props.size}>
        <Command.Dialog>
          <Command.Header>Head</Command.Header>
          <Command.InputGroup>
            <Command.InputGroup.Input />
            <Command.InputGroup.ClearButton />
          </Command.InputGroup>
          <Command.List onAction={props.onAction}>
            <Command.Group heading="Settings">
              <Command.Item id="settings" textValue="Settings preferences">
                Settings
              </Command.Item>
              <Command.Item id="cafe" textValue="Café">
                Café
              </Command.Item>
            </Command.Group>
            <Command.Separator />
            <Command.Item id="billing">Billing</Command.Item>
          </Command.List>
          <Command.Footer>Foot</Command.Footer>
        </Command.Dialog>
      </Command.Container>
    </Command.Backdrop>
  </Command>
);

test("command: opens from the button, parts + defaults, filters, empty state, a press runs", async () => {
  const actions: unknown[] = [];
  const open = signal(false);
  const r = render(() => <Palette isOpen={open} onAction={(k) => actions.push(k)} size="lg" variant="blur" />);
  assert.equal(document.querySelector("[role=dialog]"), null);
  press(document.getElementById("open")!);
  await flush();
  const dialog = document.querySelector("[role=dialog]") as HTMLElement;
  assert.equal(dialog.getAttribute("aria-label"), "Command palette");
  assert.match(dialog.className, /command__dialog command__dialog--lg/);
  assert.match((document.querySelector("[data-slot=command-backdrop]") as HTMLElement).className, /command__backdrop command__backdrop--blur/);
  assert.ok(document.querySelector("[data-slot=command-header]") && document.querySelector("[data-slot=command-footer]"));
  assert.ok(document.querySelector(".command__group-heading"));
  const input = document.querySelector("[data-slot=command-input]") as HTMLInputElement;
  assert.equal(input.getAttribute("placeholder"), "Search commands...");
  // Focus on open (the field, through `autoFocus`) is asserted in the browser suite (`menus-pro.test.ts`): happy-dom
  // defers both focus moves, so the dialog's own mount focus lands last here.
  assert.ok(input.hasAttribute("autofocus"));
  assert.equal(input.getAttribute("aria-label"), "Search commands");
  assert.equal(items().length, 3);
  type(input, "PREFER");
  await flush();
  assert.deepEqual(
    items().map((i) => i.getAttribute("data-key")),
    ["settings"],
  );
  type(input, "cafe");
  await flush();
  assert.deepEqual(
    items().map((i) => i.getAttribute("data-key")),
    ["cafe"],
    "accent-insensitive",
  );
  type(input, "zzz");
  await flush();
  // RAC Menu: the empty state sits in a keyless `role="menuitem"` wrapper.
  assert.deepEqual(
    items().filter((i) => i.hasAttribute("data-key")),
    [],
  );
  assert.match(document.querySelector("[data-slot=command-list]")!.textContent!, /No results/);
  type(input, "bill");
  await flush();
  // Arrow / Enter through the field's virtual focus: browser suite (`menus-pro.test.ts`).
  press(items().find((i) => i.getAttribute("data-key") === "billing")!);
  await flush();
  assert.deepEqual(actions, ["billing"]);
  // Unmounted while open: the cdk Menu with `renderEmptyState` disposes cleanly (its items' count cleanups no longer
  // re-run the empty-state Show under the disposed menu owner).
  cleanup(r as never);
  await flush();
  assert.equal(document.querySelector("[role=dialog]"), null);
});
