// DOM-target suite (UI-BREADCRUMB 2026-10-29): signal text in the children of collection items and other parts that render a
// render-function child keeps updating. A function child (`{() => label()}`, `{({ isSelected }) => …}`) used to be called
// once inside a `Provider` / a part body (ListBox.Item, Menu.Item, Checkbox, ProgressBar, …) and Tabs.Tab called its children
// slot in its body, so `{label()}` and `{() => label()}` there read the signal once. Breadcrumbs.Item already followed both.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Breadcrumbs } = await import("../src/components/breadcrumbs/index.ts");
const { ListBox } = await import("../src/components/list-box/index.ts");
const { Menu } = await import("../src/components/menu/index.ts");
const { Tabs } = await import("../src/components/tabs/index.ts");
const { Checkbox } = await import("../src/components/checkbox/index.ts");
const { ProgressBar } = await import("../src/components/progress-bar/index.ts");

const texts = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)].map((el) => (el.textContent ?? "").trim());

test("Breadcrumbs.Item: slot and function children follow the signal", () => {
  const label = signal("A");
  const r = render(() => (
    <Breadcrumbs>
      <Breadcrumbs.Item href="#home">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item href="#g">{label()}</Breadcrumbs.Item>
      <Breadcrumbs.Item>{() => label()}</Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  assert.deepEqual(texts(r.container, "li"), ["Home", "A", "A"]);
  label.set("B");
  assert.deepEqual(texts(r.container, "li"), ["Home", "B", "B"]);
  r.unmount();
});

test("ListBox.Item / Menu.Item: function children follow the signal", () => {
  const label = signal("A");
  const r = render(() => (
    <>
      <ListBox aria-label="List">
        <ListBox.Item id="a" textValue="a">
          {label()}
        </ListBox.Item>
        <ListBox.Item id="b" textValue="b">
          {() => label()}
        </ListBox.Item>
      </ListBox>
      <Menu aria-label="Menu">
        <Menu.Item id="a" textValue="a">
          {label()}
        </Menu.Item>
        <Menu.Item id="b" textValue="b">
          {() => label()}
        </Menu.Item>
      </Menu>
    </>
  ));
  assert.deepEqual(texts(r.container, "[role=option]"), ["A", "A"]);
  assert.deepEqual(texts(r.container, "[role=menuitem]"), ["A", "A"]);
  label.set("B");
  assert.deepEqual(texts(r.container, "[role=option]"), ["B", "B"]);
  assert.deepEqual(texts(r.container, "[role=menuitem]"), ["B", "B"]);
  r.unmount();
});

test("Tabs.Tab: slot and function children follow the signal; one indicator per tab", () => {
  const label = signal("A");
  const r = render(() => (
    <Tabs>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Tabs">
          <Tabs.Tab id="one">
            {label()}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="two">{label()}</Tabs.Tab>
          <Tabs.Tab id="three">{() => label()}</Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  ));
  const indicators = () => r.container.querySelectorAll("[role=tab]")[0]!.querySelectorAll("[data-slot=tabs-indicator]").length;
  assert.deepEqual(texts(r.container, "[role=tab]"), ["A", "A", "A"]);
  assert.equal(indicators(), 1);
  label.set("B");
  assert.deepEqual(texts(r.container, "[role=tab]"), ["B", "B", "B"]);
  assert.equal(indicators(), 1);
  r.unmount();
});

test("Checkbox / ProgressBar: render-function children follow the signal", () => {
  const label = signal("A");
  const r = render(() => (
    <>
      <div id="cb">
        <Checkbox>{({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "on " : "off ") + label()}</Checkbox>
      </div>
      <div id="pb">
        <ProgressBar aria-label="Progress" value={40}>
          {() => label()}
        </ProgressBar>
      </div>
    </>
  ));
  assert.equal(r.container.querySelector("#cb")!.textContent!.trim(), "off A");
  assert.equal(r.container.querySelector("#pb")!.textContent!.trim(), "A");
  label.set("B");
  assert.equal(r.container.querySelector("#cb")!.textContent!.trim(), "off B");
  assert.equal(r.container.querySelector("#pb")!.textContent!.trim(), "B");
  r.unmount();
});
