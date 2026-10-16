// DOM-target suite (happy-dom): `ActionBar` (Rivet-authored; feature set inspired by HeroUI Pro's public ActionBar docs).
// Exports + variants, fixed layer + toolbar pill classes / slots, default `aria-label` "Actions" / `isAttached` / horizontal
// orientation, vertical orientation, `isOpen` from a signal accessor and a live prop (`data-open` follows, nodes kept), the
// polite live region on the prefix (count text updates in place), arrow keys move focus between the actions, parts outside
// an ActionBar get only the caller's class.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ActionBar, ActionBarRoot, actionBarVariants } = await import("../src/components/action-bar/index.ts");
const { Button } = await import("../src/components/button/index.ts");

const flush = () => new Promise((r) => setTimeout(r, 20));
let scope: ParentNode = document;
const q = (sel: string) => scope.querySelector(sel) as HTMLElement | null;
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new (window as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }),
  );

test("action-bar: exports + variants", () => {
  assert.equal(ActionBar, ActionBarRoot);
  assert.equal(ActionBar.Root, ActionBarRoot);
  assert.equal(actionBarVariants().base(), "action-bar action-bar--horizontal");
  assert.equal(actionBarVariants({ orientation: "vertical" }).base(), "action-bar action-bar--vertical");
  assert.equal(actionBarVariants().wrapper(), "action-bar__wrapper");
  assert.equal(actionBarVariants().label(), "action-bar__label");
});

test("action-bar: fixed layer, toolbar pill, defaults, parts", () => {
  const r = render(() => (
    <ActionBar id="ab" isOpen class="extra">
      <ActionBar.Prefix>2 selected</ActionBar.Prefix>
      <ActionBar.Content>
        <Button>Archive</Button>
      </ActionBar.Content>
      <ActionBar.Suffix class="s">
        <Button>Clear</Button>
      </ActionBar.Suffix>
    </ActionBar>
  ));
  scope = r.container;
  const root = r.container.querySelector("#ab") as HTMLElement;
  assert.equal(root.className, "action-bar action-bar--horizontal extra");
  assert.equal(root.getAttribute("data-slot"), "action-bar");
  assert.equal(root.getAttribute("data-open"), "true");
  assert.equal(root.getAttribute("data-orientation"), "horizontal");
  const bar = q("[role=toolbar]")!;
  assert.equal(bar.parentElement, root);
  assert.equal(bar.getAttribute("aria-label"), "Actions");
  assert.equal(bar.getAttribute("data-slot"), "action-bar-wrapper");
  assert.equal(bar.getAttribute("aria-orientation"), "horizontal");
  assert.match(bar.className, /\baction-bar__wrapper\b/);
  assert.match(bar.className, /\btoolbar--attached\b/);
  const prefix = q("[data-slot=action-bar-prefix]")!;
  assert.equal(prefix.className, "action-bar__prefix");
  assert.equal(prefix.getAttribute("aria-live"), "polite");
  assert.equal(prefix.getAttribute("aria-atomic"), "true");
  assert.equal(q("[data-slot=action-bar-content]")!.className, "action-bar__content");
  assert.equal(q("[data-slot=action-bar-suffix]")!.className, "action-bar__suffix s");
});

test("action-bar: aria-label, isAttached={false}, vertical", () => {
  const r = render(() => (
    <ActionBar id="abv" isOpen={false} aria-label="Bulk actions" isAttached={false} orientation="vertical">
      <ActionBar.Content>
        <Button>One</Button>
      </ActionBar.Content>
    </ActionBar>
  ));
  scope = r.container;
  const root = r.container.querySelector("#abv") as HTMLElement;
  assert.equal(root.className, "action-bar action-bar--vertical");
  assert.equal(root.hasAttribute("data-open"), false);
  const bar = q("[role=toolbar]")!;
  assert.equal(bar.getAttribute("aria-label"), "Bulk actions");
  assert.equal(bar.getAttribute("aria-orientation"), "vertical");
  assert.doesNotMatch(bar.className, /toolbar--attached/);
});

test("action-bar: isOpen accessor + live prop follow, nodes kept; live count in the prefix", async () => {
  const count = signal(0);
  const r = render(() => (
    <div>
      <ActionBar id="acc" isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="count">{count()}</span> selected
        </ActionBar.Prefix>
      </ActionBar>
      <ActionBar id="live" isOpen={count() > 1}>
        <ActionBar.Content>x</ActionBar.Content>
      </ActionBar>
    </div>
  ));
  scope = r.container;
  const acc = r.container.querySelector("#acc") as HTMLElement;
  const live = r.container.querySelector("#live") as HTMLElement;
  const bar = acc.querySelector("[role=toolbar]");
  assert.equal(acc.hasAttribute("data-open"), false);
  assert.equal(live.hasAttribute("data-open"), false);
  count.set(1);
  await flush();
  assert.equal(acc.getAttribute("data-open"), "true");
  assert.equal(live.hasAttribute("data-open"), false);
  assert.equal(q("#count")!.textContent, "1");
  count.set(3);
  await flush();
  assert.equal(live.getAttribute("data-open"), "true");
  assert.equal(q("#count")!.textContent, "3");
  assert.equal(r.container.querySelector("#acc"), acc);
  assert.equal(acc.querySelector("[role=toolbar]"), bar);
  count.set(0);
  await flush();
  assert.equal(acc.hasAttribute("data-open"), false);
  assert.equal(live.hasAttribute("data-open"), false);
});

test("action-bar: arrow keys move focus between the actions (toolbar)", async () => {
  const r = render(() => (
    <ActionBar isOpen>
      <ActionBar.Content>
        <Button id="a1">One</Button>
        <Button id="a2">Two</Button>
      </ActionBar.Content>
    </ActionBar>
  ));
  scope = r.container;
  const a1 = q("#a1")!;
  a1.focus();
  key(a1, "ArrowRight");
  await flush();
  assert.equal(document.activeElement?.id, "a2");
});

test("action-bar: parts outside an ActionBar get only the caller's class", () => {
  const r = render(() => (
    <div>
      <ActionBar.Prefix class="p">p</ActionBar.Prefix>
      <ActionBar.Content>c</ActionBar.Content>
    </div>
  ));
  scope = r.container;
  assert.equal(q("[data-slot=action-bar-prefix]")!.className, "p");
  assert.equal(q("[data-slot=action-bar-content]")!.className, "");
});

// "action bar - X does nothing" (ui-docs `action-bar-basic`): an icon-only Button in the Suffix writes a new empty Set to
// the ListBox's two-way `selectedKeys` signal → the options uncheck and the bar closes.
test("action-bar: X clears a ListBox selection signal → options uncheck, bar closes", async () => {
  const { ListBox } = await import("../src/components/list-box/index.ts");
  const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
  const press = (el: Element) => {
    const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, width: 1, height: 1, isPrimary: true };
    el.dispatchEvent(new W.PointerEvent("pointerdown", o));
    el.dispatchEvent(new W.PointerEvent("pointerup", o));
    el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
  };
  const selected = signal<Set<string> | "all">(new Set());
  const count = () => {
    const keys = selected();
    return keys === "all" ? 3 : keys.size;
  };
  const r = render(() => (
    <div>
      <ListBox aria-label="Files" selectionMode="multiple" selectedKeys={selected as never}>
        <ListBox.Item id="a" textValue="A">
          A
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="b" textValue="B">
          B
          <ListBox.ItemIndicator />
        </ListBox.Item>
        <ListBox.Item id="c" textValue="C">
          C
          <ListBox.ItemIndicator />
        </ListBox.Item>
      </ListBox>
      <ActionBar id="abx" isOpen={() => count() > 0}>
        <ActionBar.Prefix>
          <span id="abx-count">{count()}</span> selected
        </ActionBar.Prefix>
        <ActionBar.Suffix>
          <Button id="abx-clear" isIconOnly aria-label="Clear selection" onPress={() => selected.set(new Set())}>
            x
          </Button>
        </ActionBar.Suffix>
      </ActionBar>
    </div>
  ));
  scope = r.container;
  const options = () => [...r.container.querySelectorAll("[role=option]")] as HTMLElement[];
  const checked = () => options().filter((o) => o.getAttribute("aria-selected") === "true").length;
  press(options()[0]!);
  await flush();
  press(options()[2]!);
  await flush();
  assert.equal(checked(), 2);
  assert.equal(q("#abx")!.getAttribute("data-open"), "true");
  assert.equal(q("#abx-count")!.textContent, "2");
  press(q("#abx-clear")!);
  await flush();
  assert.equal((selected() as Set<string>).size, 0);
  assert.equal(checked(), 0);
  assert.equal(r.container.querySelectorAll("[data-slot=list-box-item-indicator][data-visible]").length, 0);
  assert.equal(q("#abx")!.hasAttribute("data-open"), false);
  assert.equal(q("#abx-count")!.textContent, "0");
  // Selecting again after the clear works on the same signal.
  press(options()[1]!);
  await flush();
  assert.equal(checked(), 1);
  assert.equal(q("#abx")!.getAttribute("data-open"), "true");
  r.unmount();
});
