// DOM-target suite: `Tabs` (upstream tests/components/tabs/tabs.test.tsx ported to happy-dom): data-slots + BEM block, variant /
// align modifiers, selecting tabs by pointer (`onSelectionChange` key, selected tab + active panel) and by keyboard (arrow keys,
// automatic activation), disabled tab not selected. Rivet: part classes per slot, ListContainer chrome (scroller + scroll
// buttons with lucide chevrons, vertical labels), List `container={false}`, Separator, Indicator on the selected tab only,
// controlled two-way `selectedKey` signal, live `variant`, parts outside a Tabs, function `class`, index exports; identity
// folds: List renders the container without a ListContainer (same markup), automatic Indicator (explicit one not doubled,
// `indicator={false}` on Tab / root).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/tabs/index.ts");
const { Tabs } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const key = (el: Element, k: string) => el.dispatchEvent(new W.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));

const Items = () => (
  <>
    <Tabs.ListContainer>
      <Tabs.List aria-label="Options">
        <Tabs.Tab id="overview">
          Overview
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab id="analytics">
          Analytics
          <Tabs.Indicator />
        </Tabs.Tab>
        <Tabs.Tab isDisabled id="reports">
          Reports
          <Tabs.Indicator />
        </Tabs.Tab>
      </Tabs.List>
    </Tabs.ListContainer>
    <Tabs.Panel id="overview">{() => "Overview panel"}</Tabs.Panel>
    <Tabs.Panel id="analytics">{() => "Analytics panel"}</Tabs.Panel>
    <Tabs.Panel id="reports">{() => "Reports panel"}</Tabs.Panel>
  </>
);
const Fixture = (props: Record<string, unknown>) => (
  <Tabs data-testid="tabs" {...props}>
    <Items />
  </Tabs>
);

const renderTabs = async (props: Record<string, unknown> = {}) => {
  const r = render(() => <Fixture {...props} />);
  await flush();
  return r;
};

const all = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const tab = (root: ParentNode, name: string) => all(root, "[role=tab]").find((t) => t.textContent?.trim() === name)!;
const selectedTab = (root: ParentNode) => root.querySelector<HTMLElement>('[role=tab][aria-selected="true"]')!;
const activePanel = (root: ParentNode) => root.querySelector<HTMLElement>("[role=tabpanel]")!;

test("exposes data-slots and BEM block", async () => {
  const r = await renderTabs();
  const root = r.container.querySelector<HTMLElement>('[data-testid="tabs"]')!;
  assert.equal(root.getAttribute("data-slot"), "tabs");
  assert.match(root.className, /\btabs\b/);
  assert.ok(r.container.querySelector('[data-slot="tabs-list"]'));
  assert.equal(all(r.container, '[data-slot="tabs-tab"]').length, 3);
  assert.ok(r.container.querySelector('[data-slot="tabs-panel"]'));
  // Rivet: part classes.
  assert.match(r.container.querySelector('[data-slot="tabs-list"]')!.className, /\btabs__list\b/);
  assert.match(all(r.container, '[data-slot="tabs-tab"]')[0]!.className, /\btabs__tab\b/);
  assert.match(r.container.querySelector('[data-slot="tabs-panel"]')!.className, /\btabs__panel\b/);
  assert.equal(root.getAttribute("data-orientation"), "horizontal");
  r.unmount();
});

test("exposes variant BEM modifier", async () => {
  const r = await renderTabs({ variant: "secondary" });
  assert.match(r.container.querySelector<HTMLElement>('[data-testid="tabs"]')!.className, /tabs--secondary/);
  r.unmount();
});

test("exposes align BEM modifier", async () => {
  const r = await renderTabs({ align: "start" });
  assert.match(r.container.querySelector<HTMLElement>('[data-testid="tabs"]')!.className, /tabs--align-start/);
  r.unmount();
});

test("omits the align BEM modifier when centered by default", async () => {
  const r = await renderTabs();
  assert.doesNotMatch(r.container.querySelector<HTMLElement>('[data-testid="tabs"]')!.className, /tabs--align-/);
  r.unmount();
});

test("supports selecting tabs (pointer)", async () => {
  const calls: unknown[] = [];
  const r = await renderTabs({ onSelectionChange: (k: unknown) => calls.push(k) });
  assert.equal(all(r.container, "[role=tab]").length, 3);
  assert.equal(selectedTab(r.container).textContent?.trim(), "Overview");
  assert.equal(activePanel(r.container).textContent, "Overview panel");
  press(tab(r.container, "Analytics"));
  await flush();
  assert.deepEqual(calls, ["analytics"]);
  assert.equal(selectedTab(r.container).textContent?.trim(), "Analytics");
  assert.equal(activePanel(r.container).textContent, "Analytics panel");
  r.unmount();
});

test("supports keyboard selection", async () => {
  const r = await renderTabs();
  const first = tab(r.container, "Overview");
  first.focus();
  key(first, "ArrowRight");
  await flush();
  assert.equal(selectedTab(r.container).textContent?.trim(), "Analytics");
  assert.equal(document.activeElement, tab(r.container, "Analytics"));
  // The disabled Reports tab is skipped (wraps to Overview).
  key(tab(r.container, "Analytics"), "ArrowRight");
  await flush();
  assert.equal(selectedTab(r.container).textContent?.trim(), "Overview");
  r.unmount();
});

test("supports disabled tabs without selecting", async () => {
  const calls: unknown[] = [];
  const r = await renderTabs({ onSelectionChange: (k: unknown) => calls.push(k) });
  const reports = tab(r.container, "Reports");
  assert.equal(reports.getAttribute("aria-disabled"), "true");
  press(reports);
  await flush();
  assert.equal(selectedTab(r.container).textContent?.trim(), "Overview");
  assert.ok(!calls.includes("reports"));
  r.unmount();
});

test("Rivet: ListContainer renders the scroller and scroll buttons around the list", async () => {
  const r = await renderTabs();
  const container = r.container.querySelector<HTMLElement>('[data-slot="tabs-list-container"]')!;
  assert.match(container.className, /\btabs__list-container\b/);
  const [scroller, prev, next] = [...container.children] as HTMLElement[];
  assert.equal(scroller!.getAttribute("data-slot"), "scroll-shadow");
  assert.match(scroller!.className, /tabs__list-container__scroller/);
  assert.equal(scroller!.getAttribute("data-orientation"), "horizontal");
  assert.equal(scroller!.firstElementChild!.getAttribute("role"), "tablist");
  assert.equal(prev!.getAttribute("aria-label"), "Scroll tabs left");
  assert.equal(next!.getAttribute("aria-label"), "Scroll tabs right");
  assert.match(prev!.className, /tabs__list-container__scroll-prev/);
  assert.match(next!.className, /tabs__list-container__scroll-next/);
  assert.equal(prev!.getAttribute("tabindex"), "-1");
  assert.equal(prev!.getAttribute("type"), "button");
  assert.ok(prev!.querySelector("svg"), "lucide chevron");
  // Scroll buttons move the scroller (clamped).
  const calls: ScrollToOptions[] = [];
  Object.defineProperties(scroller!, {
    clientWidth: { value: 100, configurable: true },
    scrollWidth: { value: 300, configurable: true },
  });
  scroller!.scrollTo = ((o: ScrollToOptions) => calls.push(o)) as never;
  next!.click();
  assert.deepEqual(calls, [{ behavior: "smooth", left: 80 }]);
  prev!.click();
  assert.equal(calls.length, 1, "already at the start");
  r.unmount();
});

test("Rivet: vertical ListContainer labels + chevrons", async () => {
  const r = await renderTabs({ orientation: "vertical" });
  const container = r.container.querySelector<HTMLElement>('[data-slot="tabs-list-container"]')!;
  const [scroller, prev, next] = [...container.children] as HTMLElement[];
  assert.equal(scroller!.getAttribute("data-orientation"), "vertical");
  assert.equal(prev!.getAttribute("aria-label"), "Scroll tabs up");
  assert.equal(next!.getAttribute("aria-label"), "Scroll tabs down");
  assert.equal(r.container.querySelector("[role=tablist]")!.getAttribute("aria-orientation"), "vertical");
  r.unmount();
});

test("Rivet: List container={false} is a plain tablist; Separator; Indicator only on the selected tab", async () => {
  const r = render(() => (
    <Tabs>
      <Tabs.List aria-label="Plain" class="mine" container={false}>
        <Tabs.Tab id="a">
          A
          <Tabs.Indicator class="ind" />
        </Tabs.Tab>
        <Tabs.Tab id="b">
          <Tabs.Separator class="sep" />B
          <Tabs.Indicator class="ind" />
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">a</Tabs.Panel>
      <Tabs.Panel id="b">{() => "b"}</Tabs.Panel>
    </Tabs>
  ));
  await flush();
  assert.equal(r.container.querySelector('[data-slot="tabs-list-container"]') === null, true);
  const list = r.container.querySelector<HTMLElement>("[role=tablist]")!;
  assert.equal(list.getAttribute("data-slot"), "tabs-list");
  assert.match(list.className, /\btabs__list\b.*\bmine\b/);
  const sep = r.container.querySelector<HTMLElement>('[data-slot="tabs-separator"]')!;
  assert.equal(sep.tagName, "SPAN");
  assert.equal(sep.getAttribute("aria-hidden"), "true");
  assert.match(sep.className, /\btabs__separator\b.*\bsep\b/);
  const indicators = all(r.container, '[data-slot="tabs-indicator"]');
  assert.equal(indicators.length, 1);
  assert.match(indicators[0]!.className, /\btabs__indicator\b.*\bind\b/);
  assert.ok(tab(r.container, "A").contains(indicators[0]!));
  press(tab(r.container, "B"));
  await flush();
  const moved = all(r.container, '[data-slot="tabs-indicator"]');
  assert.equal(moved.length, 1);
  assert.ok(tab(r.container, "B").contains(moved[0]!));
  r.unmount();
});

test("Rivet: controlled two-way selectedKey signal", async () => {
  const selected = signal<string | number | null>("analytics");
  const r = render(() => (
    <Tabs selectedKey={selected}>
      <Items />
    </Tabs>
  ));
  await flush();
  assert.equal(selectedTab(r.container).textContent?.trim(), "Analytics");
  press(tab(r.container, "Overview"));
  await flush();
  assert.equal(selected(), "overview");
  selected.set("analytics");
  await flush();
  assert.equal(selectedTab(r.container).textContent?.trim(), "Analytics");
  assert.equal(activePanel(r.container).textContent, "Analytics panel");
  r.unmount();
});

test("Rivet: live variant updates the root class in place", async () => {
  const variant = signal<"primary" | "secondary">("primary");
  const r = render(() => (
    <Tabs data-testid="tabs" variant={variant()}>
      <Items />
    </Tabs>
  ));
  await flush();
  const root = r.container.querySelector<HTMLElement>('[data-testid="tabs"]')!;
  assert.doesNotMatch(root.className, /tabs--secondary/);
  variant.set("secondary");
  await flush();
  assert.equal(r.container.querySelector('[data-testid="tabs"]'), root);
  assert.match(root.className, /tabs--secondary/);
  r.unmount();
});

test("Rivet: function class on Tab gets the cdk render props", async () => {
  const r = render(() => (
    <Tabs>
      <Tabs.List aria-label="Fn">
        <Tabs.Tab id="a" class={({ isSelected }) => (isSelected() ? "on" : "off")}>
          A
        </Tabs.Tab>
        <Tabs.Tab id="b" class={({ isSelected }) => (isSelected() ? "on" : "off")}>
          B
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  ));
  await flush();
  assert.match(tab(r.container, "A").className, /\btabs__tab\b.*\bon\b/);
  assert.match(tab(r.container, "B").className, /\boff\b/);
  press(tab(r.container, "B"));
  await flush();
  assert.match(tab(r.container, "B").className, /\bon\b/);
  r.unmount();
});

test("Rivet: Separator outside a Tabs gets only the caller's class", () => {
  const r = render(() => <Tabs.Separator class="x" />);
  assert.equal(r.container.querySelector('[data-slot="tabs-separator"]')!.className, "x");
  r.unmount();
});

test("index exports", () => {
  assert.equal(ui.Tabs, ui.TabsRoot);
  assert.equal(ui.Tabs.Root, ui.TabsRoot);
  assert.equal(ui.Tabs.ListContainer, ui.TabListContainer);
  assert.equal(ui.Tabs.List, ui.TabList);
  assert.equal(ui.Tabs.Tab, ui.Tab);
  assert.equal(ui.Tabs.Indicator, ui.TabIndicator);
  assert.equal(ui.Tabs.Separator, ui.TabSeparator);
  assert.equal(ui.Tabs.Panel, ui.TabPanel);
  assert.equal(ui.tabsVariants().base(), "tabs");
});

// Identity spec §4.2: ListContainer folded into List, automatic Indicator.
test("Rivet: List renders the container by default and Tab its indicator: same markup as the explicit parts", async () => {
  const mask = (h: string) => h.replace(/ (id|aria-controls|aria-labelledby|data-key|data-collection)="[^"]*"/g, "");
  const explicit = render(() => (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Options">
          <Tabs.Tab id="a">
            A
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="b">
            B
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="a">{() => "a"}</Tabs.Panel>
      <Tabs.Panel id="b">{() => "b"}</Tabs.Panel>
    </Tabs>
  ));
  await flush();
  const before = mask((explicit.container as HTMLElement).innerHTML);
  explicit.unmount();
  const folded = render(() => (
    <Tabs>
      <Tabs.List aria-label="Options">
        <Tabs.Tab id="a">A</Tabs.Tab>
        <Tabs.Tab id="b">B</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">{() => "a"}</Tabs.Panel>
      <Tabs.Panel id="b">{() => "b"}</Tabs.Panel>
    </Tabs>
  ));
  await flush();
  assert.ok(before.includes('data-slot="tabs-list-container"') && before.includes('data-slot="tabs-indicator"'), before);
  assert.equal(mask((folded.container as HTMLElement).innerHTML), before);
  // the indicator follows the selection
  press(tab(folded.container, "B"));
  await flush();
  const moved = all(folded.container, '[data-slot="tabs-indicator"]');
  assert.equal(moved.length, 1);
  assert.equal(tab(folded.container, "B").contains(moved[0]!), true);
  folded.unmount();
});

test("Rivet: indicator={false} on the root or a Tab; render-function Tab children keep the automatic indicator", async () => {
  const r = render(() => (
    <Tabs indicator={false}>
      <Tabs.List aria-label="Off">
        <Tabs.Tab id="a">A</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">a</Tabs.Panel>
    </Tabs>
  ));
  await flush();
  assert.equal(all(r.container, '[data-slot="tabs-indicator"]').length, 0);
  r.unmount();
  const r2 = render(() => (
    <Tabs>
      <Tabs.List aria-label="Mixed">
        <Tabs.Tab id="a" indicator={false}>
          A
        </Tabs.Tab>
        <Tabs.Tab id="b">
          {({ isSelected }: { isSelected: () => boolean }) =>
            () =>
              isSelected() ? "B*" : "B"
            }
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id="a">a</Tabs.Panel>
      <Tabs.Panel id="b">{() => "b"}</Tabs.Panel>
    </Tabs>
  ));
  await flush();
  assert.equal(all(r2.container, '[data-slot="tabs-indicator"]').length, 0);
  press(tab(r2.container, "B"));
  await flush();
  const ind = all(r2.container, '[data-slot="tabs-indicator"]');
  assert.equal(
    ind.length,
    1,
    all(r2.container, "[role=tab]")
      .map((t) => t.textContent)
      .join("|"),
  );
  const tabs = all(r2.container, "[role=tab]");
  assert.equal(tabs[1]!.contains(ind[0]!), true);
  assert.equal(tabs[1]!.textContent, "B*");
  r2.unmount();
});
