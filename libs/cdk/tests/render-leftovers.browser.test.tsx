// RAC `render` prop (react-aria-components DOMRenderProps) on the remaining parts: ListBox, ListBoxItem, ListBoxSection,
// Header, Tree, TreeItem, TreeSection, TreeHeader, NavigationTree pass-through, DateInput, ColorSwatchPicker(Item).
// Ports RAC "should support custom render function" (ListBox, Tree tests): the returned element replaces the default
// one and keeps the part's attributes (parity with the default element), roles and interactions.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { userEvent } from "@testing-library/user-event";
import { ListBox, ListBoxItem, ListBoxSection } from "../listbox/index.tsx";
import { Header } from "../header/index.tsx";
import { Tree, TreeHeader, TreeItem, TreeItemContent, TreeSection } from "../tree/index.tsx";
import { NavigationTree, NavigationTreeItem, NavigationTreeItemContent } from "../navigation-tree/index.tsx";
import { DateField, DateInput, DateSegment } from "../date-field/index.tsx";
import { ColorSwatchPicker, ColorSwatchPickerItem } from "../color-swatch-picker/index.tsx";
import { ColorSwatch } from "../color-swatch/index.tsx";

afterEach(async () => {
  cleanup();
  await flush();
});

const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;
const attrNames = (el: Element) => [...el.attributes].map((a) => a.name).sort();

describe("render prop: ListBox", () => {
  const list = (extra: Record<string, unknown> = {}, itemExtra: Record<string, unknown> = {}) => (
    <ListBox aria-label="L" data-testid="lb" selectionMode="single" {...extra}>
      <ListBoxItem id="a" {...itemExtra}>
        A
      </ListBoxItem>
      <ListBoxItem id="b" {...itemExtra}>
        B
      </ListBoxItem>
    </ListBox>
  );

  it("ListBox root replaced, attributes equal the default's", () => {
    const def = mount(() => list()).querySelector("[data-testid=lb]")!;
    const c = mount(() => list({ render: (p: object) => <section {...(p as {})} data-r="1" /> }));
    const el = c.querySelector("[data-testid=lb]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("role")).toBe("listbox");
    expect(el.getAttribute("class")).toBe("rv-ListBox");
    expect(attrNames(el).filter((n) => n !== "data-r")).toEqual(attrNames(def));
    expect(c.querySelectorAll("[role=option]").length).toBe(2);
  });

  it("ListBoxItem replaced: render props, selection by click, press handler", async () => {
    const user = userEvent.setup();
    let pressed = 0;
    const c = mount(() =>
      list(
        {},
        {
          onPress: () => pressed++,
          render: (p: object, rp: { isSelected: () => boolean }) => <li {...(p as {})} data-sel={String(rp.isSelected())} />,
        },
      ),
    );
    const items = [...c.querySelectorAll("[role=option]")];
    expect(items.every((i) => i.tagName === "LI")).toBe(true);
    expect(items[0]!.getAttribute("class")).toBe("rv-ListBoxItem");
    await user.click(items[0]!);
    await flush();
    expect(items[0]!.getAttribute("aria-selected")).toBe("true");
    expect(items[0]!.hasAttribute("data-selected")).toBe(true);
    expect(pressed).toBe(1);
  });

  it("ListBoxItem link: render keeps href", () => {
    const c = mount(() => (
      <ListBox aria-label="L">
        <ListBoxItem id="a" href="/x" render={(p) => <a {...(p as {})} data-r="1" />}>
          A
        </ListBoxItem>
      </ListBox>
    ));
    const a = c.querySelector("[role=option]")!;
    expect(a.getAttribute("href")).toBe("/x");
    expect(a.getAttribute("data-r")).toBe("1");
  });

  it("ListBoxSection + Header replaced", () => {
    const c = mount(() => (
      <ListBox aria-label="L">
        <ListBoxSection data-testid="sec" render={(p) => <div {...(p as {})} data-r="s" />}>
          <Header render={(p) => <h4 {...(p as {})} data-r="h" />}>Head</Header>
          <ListBoxItem id="a">A</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    const sec = c.querySelector("[data-testid=sec]")!;
    expect(sec.tagName).toBe("DIV");
    expect(sec.getAttribute("role")).toBe("group");
    expect(sec.getAttribute("aria-labelledby")).toBeTruthy();
    expect(sec.querySelector("h4[data-r=h]")).not.toBeNull();
  });
});

const tree = (treeExtra: Record<string, unknown> = {}, itemExtra: Record<string, unknown> = {}) => (
  <Tree aria-label="T" data-testid="tree" selectionMode="single" defaultExpandedKeys={["p"]} {...treeExtra}>
    <TreeItem id="p" textValue="P" {...itemExtra}>
      <TreeItemContent>P</TreeItemContent>
      <TreeItem id="c" textValue="C" {...itemExtra}>
        <TreeItemContent>C</TreeItemContent>
      </TreeItem>
    </TreeItem>
  </Tree>
);

describe("render prop: Tree", () => {
  it("Tree root replaced, attributes equal the default's", () => {
    const def = mount(() => tree()).querySelector("[data-testid=tree]")!;
    const c = mount(() => tree({ render: (p: object) => <section {...(p as {})} data-r="1" /> }));
    const el = c.querySelector("[data-testid=tree]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("role")).toBe("treegrid");
    expect(el.getAttribute("class")).toBe("rv-Tree");
    expect(attrNames(el).filter((n) => n !== "data-r")).toEqual(attrNames(def));
    expect(c.querySelectorAll("[role=row]").length).toBe(2);
  });

  it("TreeItem replaced: attrs equal the default's, reactive state follows a click", async () => {
    const user = userEvent.setup();
    const def = mount(() => tree()).querySelectorAll("[role=row]");
    const c = mount(() =>
      tree({}, { render: (p: object, rp: { isSelected: () => boolean }) => <article {...(p as {})} data-sel={String(rp.isSelected())} /> }),
    );
    const rows = [...c.querySelectorAll("[role=row]")];
    expect(rows.every((r) => r.tagName === "ARTICLE")).toBe(true);
    expect(attrNames(rows[0]!).filter((n) => n !== "data-sel")).toEqual(attrNames(def[0]!));
    expect(rows[0]!.getAttribute("aria-level")).toBe("1");
    expect(rows[1]!.getAttribute("aria-level")).toBe("2");
    expect(rows[0]!.getAttribute("aria-expanded")).toBe("true");
    await user.click(rows[1]!);
    await flush();
    expect(rows[1]!.getAttribute("aria-selected")).toBe("true");
    expect(rows[1]!.hasAttribute("data-selected")).toBe(true);
    expect(rows[1]!.getAttribute("data-sel")).toBe("true");
  });

  it("TreeSection + TreeHeader replaced", () => {
    const c = mount(() => (
      <Tree aria-label="T">
        <TreeSection data-testid="sec" render={(p) => <div {...(p as {})} data-r="s" />}>
          <TreeHeader render={(p) => <div {...(p as {})} data-r="h" />}>Head</TreeHeader>
          <TreeItem id="a" textValue="A">
            <TreeItemContent>A</TreeItemContent>
          </TreeItem>
        </TreeSection>
      </Tree>
    ));
    const sec = c.querySelector("[data-testid=sec]")!;
    expect(sec.getAttribute("data-r")).toBe("s");
    expect(sec.getAttribute("role")).toBe("rowgroup");
    expect(sec.querySelector("[data-r=h]")).not.toBeNull();
  });

  it("NavigationTree passes render through", () => {
    const c = mount(() => (
      <NavigationTree aria-label="N" selectedRoute="/a" data-testid="nav" render={(p) => <section {...(p as {})} />}>
        <NavigationTreeItem id="a" textValue="A" href="/a" render={(p) => <article {...(p as {})} />}>
          <NavigationTreeItemContent>A</NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(c.querySelector("[data-testid=nav]")!.tagName).toBe("SECTION");
    const row = c.querySelector("[role=row]")!;
    expect(row.tagName).toBe("ARTICLE");
    expect(row.hasAttribute("data-current")).toBe(true);
  });
});

describe("render prop: DateInput, ColorSwatchPicker", () => {
  it("DateInput forwards render to its Group", () => {
    const c = mount(() => (
      <DateField aria-label="d">
        <DateInput data-testid="di" render={(p) => <section {...(p as {})} data-r="1" />}>
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
      </DateField>
    ));
    const el = c.querySelector("[data-testid=di]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("data-r")).toBe("1");
    expect(el.getAttribute("role")).toBe("group");
    expect(el.querySelectorAll("[role=spinbutton]").length).toBeGreaterThan(0);
  });

  it("ColorSwatchPicker + Item forward render", async () => {
    const user = userEvent.setup();
    const c = mount(() => (
      <ColorSwatchPicker defaultValue="#f00" data-testid="csp" render={(p) => <section {...(p as {})} />}>
        <ColorSwatchPickerItem color="#f00" render={(p) => <li {...(p as {})} />}>
          <ColorSwatch />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#0f0" render={(p) => <li {...(p as {})} />}>
          <ColorSwatch />
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
    ));
    expect(c.querySelector("[data-testid=csp]")!.tagName).toBe("SECTION");
    const items = [...c.querySelectorAll("[role=option]")];
    expect(items.length).toBe(2);
    expect(items.every((i) => i.tagName === "LI")).toBe(true);
    expect(items[0]!.getAttribute("aria-selected")).toBe("true");
    await user.click(items[1]!);
    await flush();
    expect(items[1]!.getAttribute("aria-selected")).toBe("true");
  });
});
