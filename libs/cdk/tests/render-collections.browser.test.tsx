// RAC `render` prop (react-aria-components DOMRenderProps) on the collection, menu and overlay parts.
// Ports RAC "should support custom render function" (Breadcrumbs, ComboBox, GridList, Menu, TagGroup, Toolbar, Tooltip,
// Popover, Modal, Dialog, Disclosure, Toast tests): the returned element replaces the default one and keeps the
// part's attributes (`attrs` equal the default element's across states). Overlay parts: the shared overlay layer still
// owns stacking (inline `position` / `z-index`, `data-rv-overlay`, the underlay) with `render` set. Rivet: render
// props are accessors; `props` are cast to `{}` when spread.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Breadcrumb, Breadcrumbs } from "../breadcrumbs/index.tsx";
import { Toolbar } from "../toolbar/index.tsx";
import { Link } from "../link/index.tsx";
import { Label } from "../label/index.tsx";
import { Input } from "../input/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { ComboBox, ComboBoxValue } from "../combobox/index.tsx";
import { GridList, GridListHeader, GridListItem, GridListSection } from "../grid-list/index.tsx";
import { Menu, MenuItem, MenuSection, MenuTrigger } from "../menu/index.tsx";
import { Header } from "../header/index.tsx";
import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";
import { Tooltip, TooltipTrigger } from "../tooltip/index.tsx";
import { Popover } from "../popover/index.tsx";
import { OverlayArrow } from "../overlay-arrow/index.tsx";
import { Modal, ModalOverlay } from "../modal/index.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { Disclosure, DisclosureGroup, DisclosurePanel } from "../disclosure/index.tsx";
import { Heading } from "../heading/index.tsx";
import { Text } from "../text/index.tsx";
import {
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
  UNSTABLE_ToastRegion as ToastRegion,
} from "../toast/index.tsx";

afterEach(async () => {
  cleanup();
  await flush();
});

const screen = () => within(document.body);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flush();
};
const attrNames = (el: Element) => [...el.attributes].map((a) => a.name).sort();

describe("render prop: collections", () => {
  it("Breadcrumbs / Breadcrumb: <ol> / <li> replaced, attrs and renderProps kept", () => {
    const seen: boolean[] = [];
    const c = mount(() => (
      <Breadcrumbs aria-label="nav" data-testid="ol" render={(props) => <div {...(props as {})} data-r="ol" />}>
        <Breadcrumb id="a" render={(props, rp) => (seen.push(rp.isCurrent()), (<p {...(props as {})} data-r="li" />))}>
          <Link href="/a">A</Link>
        </Breadcrumb>
        <Breadcrumb id="b">
          <Link href="/b">B</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    const ol = c.querySelector("[data-r=ol]")!;
    expect(ol.tagName).toBe("DIV");
    expect(ol.getAttribute("aria-label")).toBe("nav");
    expect(ol.getAttribute("class")).toBe("rv-Breadcrumbs");
    const li = c.querySelector("[data-r=li]")!;
    expect(li.tagName).toBe("P");
    expect(li.getAttribute("class")).toBe("rv-Breadcrumb");
    expect(li.textContent).toBe("A");
    expect(seen[0]).toBe(false);
    expect(c.querySelector("ol")).toBeNull();
  });

  it("Toolbar: replaced, parity with the default element, key handler runs on the rendered element", async () => {
    const tb = (render?: never) => (
      <Toolbar aria-label="t" data-testid="tb" render={render}>
        <Button>a</Button>
        <Button>b</Button>
      </Toolbar>
    );
    const d = mount(() => tb()).querySelector("[data-testid=tb]")!;
    const c = mount(() => tb(((props: object) => <div {...props} />) as never)).querySelector("[data-testid=tb]:not(:first-child), [data-testid=tb]")!;
    expect(c.tagName).toBe("DIV");
    expect(attrNames(c).filter((n) => n !== "data-rk")).toEqual(attrNames(d).filter((n) => n !== "data-rk"));
    cleanup();
    mount(() => tb(((props: object) => <section {...props} />) as never));
    const el = screen().getByRole("toolbar");
    expect(el.tagName).toBe("SECTION");
    const [a, b] = screen().getAllByRole("button");
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(b);
  });

  it("ComboBox / ComboBoxValue: <div> replaced", () => {
    const c = mount(() => (
      <ComboBox selectionMode="multiple" data-testid="cb" render={(props, rp) => <section {...(props as {})} data-open-rp={String(rp.isOpen())} />}>
        <Label>L</Label>
        <Input />
        <Button />
        <ComboBoxValue placeholder="none" render={(props) => <b {...(props as {})} />} />
        <Popover>
          <ListBox>
            <ListBoxItem id="1">Cat</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>
    ));
    const root = c.querySelector("[data-testid=cb]")!;
    expect(root.tagName).toBe("SECTION");
    expect(root.getAttribute("data-open-rp")).toBe("false");
    const value = c.querySelector("b")!;
    expect(value.getAttribute("data-placeholder")).toBe("true");
    expect(value.textContent).toBe("none");
  });

  it("GridList / GridListItem / Section / Header: elements replaced, item handlers still select", async () => {
    const c = mount(() => (
      <GridList aria-label="g" selectionMode="single" data-testid="gl" render={(props) => <section {...(props as {})} />}>
        <GridListItem id="x" textValue="X" render={(props, rp) => <article {...(props as {})} data-id={String(rp.id)} />}>
          X
        </GridListItem>
        <GridListSection id="s" render={(props) => <div {...(props as {})} data-sec="" />}>
          <GridListHeader render={(props) => <h4 {...(props as {})} />}>Head</GridListHeader>
          <GridListItem id="y" textValue="Y">
            Y
          </GridListItem>
        </GridListSection>
      </GridList>
    ));
    const grid = c.querySelector("[role=grid]")!;
    expect(grid.tagName).toBe("SECTION");
    expect(grid.getAttribute("data-testid")).toBe("gl");
    const row = c.querySelector("article")!;
    expect(row.getAttribute("role")).toBe("row");
    expect(row.getAttribute("data-id")).toBe("x");
    expect(c.querySelector("[data-sec]")).not.toBeNull();
    expect(c.querySelector("h4")!.getAttribute("data-type")).toBe("header");
    await userEvent.click(row);
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(row.hasAttribute("data-selected")).toBe(true);
  });

  it("TagGroup / TagList / Tag: elements replaced, click selects", async () => {
    const c = mount(() => (
      <TagGroup selectionMode="single" render={(props) => <section {...(props as {})} data-tg="" />}>
        <Label>Tags</Label>
        <TagList render={(props, rp) => <nav {...(props as {})} data-empty-rp={String(rp.isEmpty())} />}>
          <Tag id="a" render={(props, rp) => <span {...(props as {})} data-id={String(rp.id)} />}>
            A
          </Tag>
        </TagList>
      </TagGroup>
    ));
    expect(c.querySelector("[data-tg]")!.tagName).toBe("SECTION");
    const list = c.querySelector("nav")!;
    expect(list.getAttribute("role")).toBe("grid");
    expect(list.getAttribute("data-empty-rp")).toBe("false");
    const tag = c.querySelector("[role=row]")!;
    expect(tag.tagName).toBe("SPAN");
    expect(tag.getAttribute("data-id")).toBe("a");
    await userEvent.click(tag);
    expect(tag.getAttribute("aria-selected")).toBe("true");
  });

  it("Menu / MenuSection / MenuItem (link) : elements replaced, actions run", async () => {
    let acted = 0;
    mount(() => (
      <MenuTrigger defaultOpen>
        <Button>open</Button>
        <Popover>
          <Menu aria-label="m" render={(props) => <section {...(props as {})} data-m="" />}>
            <MenuSection render={(props) => <div {...(props as {})} data-ms="" />}>
              <Header>H</Header>
              <MenuItem id="a" onAction={() => acted++} render={(props, rp) => <b {...(props as {})} data-sel={String(rp.isSelected())} />}>
                A
              </MenuItem>
              <MenuItem id="l" href="/z" render={(props) => <i {...(props as {})} />}>
                L
              </MenuItem>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
    ));
    await settle();
    const menu = document.querySelector("[data-m]")!;
    expect(menu.tagName).toBe("SECTION");
    expect(menu.getAttribute("role")).toBe("menu");
    expect(document.querySelector("[data-ms]")!.getAttribute("role")).toBe("group");
    const item = screen().getByText("A");
    expect(item.tagName).toBe("B");
    expect(item.getAttribute("role")).toBe("menuitem");
    expect(item.getAttribute("data-sel")).toBe("false");
    const link = screen().getByText("L");
    expect(link.tagName).toBe("I");
    expect(link.getAttribute("href")).toBe("/z");
    await userEvent.click(item);
    expect(acted).toBe(1);
  });
});

describe("render prop: overlays", () => {
  it("Popover: element replaced; underlay, data-rv-overlay and JS stacking stay", async () => {
    mount(() => (
      <DialogTrigger defaultOpen>
        <Button>t</Button>
        <Popover data-testid="pop" render={(props, rp) => <section {...(props as {})} data-placement-rp={String(rp.placement())} />}>
          <OverlayArrow render={(props) => <span {...(props as {})} data-arrow="" />} />
          <Dialog>Popover</Dialog>
        </Popover>
      </DialogTrigger>
    ));
    await settle();
    const pop = screen().getByTestId("pop");
    expect(pop.tagName).toBe("SECTION");
    expect(pop.hasAttribute("data-rv-overlay")).toBe(true);
    expect(pop.style.position).toBe("absolute");
    expect(pop.style.zIndex).not.toBe("");
    const underlay = document.querySelector("[data-rv-underlay]") as HTMLElement;
    expect(underlay.style.position).toBe("fixed");
    expect(pop.querySelector("[data-arrow]")!.tagName).toBe("SPAN");
    expect(pop.querySelector("[data-arrow]")!.getAttribute("data-placement")).not.toBeNull();
  });

  it("Tooltip: element replaced, role / placement / positioning kept", async () => {
    mount(() => (
      <TooltipTrigger isOpen delay={0}>
        <Button>t</Button>
        <Tooltip render={(props, rp) => <aside {...(props as {})} data-p={String(rp.placement())} />}>tip</Tooltip>
      </TooltipTrigger>
    ));
    await settle();
    const tip = screen().getByRole("tooltip");
    expect(tip.tagName).toBe("ASIDE");
    expect(tip.getAttribute("class")).toBe("rv-Tooltip");
    expect(tip.style.position).toBe("absolute");
    expect(tip.style.zIndex).not.toBe("");
  });

  it("ModalOverlay / Modal / Dialog: elements replaced, inline overlay stacking and marker stay", async () => {
    mount(() => (
      <DialogTrigger defaultOpen>
        <Button>t</Button>
        <ModalOverlay data-testid="ov" render={(props) => <section {...(props as {})} />}>
          <Modal data-testid="md" render={(props, rp) => <article {...(props as {})} data-ent={String(rp.isEntering())} />}>
            <Dialog data-testid="dg" render={(props) => <div {...(props as {})} />}>
              <Heading slot="title">T</Heading>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </DialogTrigger>
    ));
    await settle();
    const ov = screen().getByTestId("ov");
    expect(ov.tagName).toBe("SECTION");
    expect(ov.style.position).toBe("fixed");
    expect(ov.style.zIndex).toBe("100");
    const md = screen().getByTestId("md");
    expect(md.tagName).toBe("ARTICLE");
    expect(md.hasAttribute("data-rv-overlay")).toBe(true);
    const dg = screen().getByTestId("dg");
    expect(dg.tagName).toBe("DIV");
    expect(dg.getAttribute("role")).toBe("dialog");
    expect(dg.getAttribute("tabindex")).toBe("-1");
  });

  it("Disclosure group / disclosure / panel: elements replaced, button toggles", async () => {
    const c = mount(() => (
      <DisclosureGroup data-testid="grp" render={(props) => <section {...(props as {})} />}>
        <Disclosure id="a" data-testid="d" render={(props, rp) => <article {...(props as {})} data-exp={String(rp.isExpanded())} />}>
          <Button slot="trigger">T</Button>
          <DisclosurePanel data-testid="p" render={(props) => <aside {...(props as {})} />}>
            body
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    ));
    expect(c.querySelector("[data-testid=grp]")!.tagName).toBe("SECTION");
    const d = c.querySelector("[data-testid=d]")!;
    expect(d.tagName).toBe("ARTICLE");
    const panel = c.querySelector("[data-testid=p]")!;
    expect(panel.tagName).toBe("ASIDE");
    expect(panel.hasAttribute("hidden")).toBe(true);
    await userEvent.click(c.querySelector("button")!);
    await settle();
    expect(d.hasAttribute("data-expanded")).toBe(true);
    expect(panel.hasAttribute("hidden")).toBe(false);
  });

  it("Toast region / toast / content: elements replaced", async () => {
    const queue = new ToastQueue<{ title: string }>();
    mount(() => (
      <>
        <ToastRegion queue={queue} data-testid="reg" render={(props) => <section {...(props as {})} />}>
          {({ toast }) => (
            <Toast toast={toast} data-testid="toast" render={(props) => <article {...(props as {})} />}>
              <ToastContent data-testid="content" render={(props) => <p {...(props as {})} />}>
                <Text slot="title">{toast.content.title}</Text>
              </ToastContent>
            </Toast>
          )}
        </ToastRegion>
        <Button onPress={() => queue.add({ title: "Hi" })}>add</Button>
      </>
    ));
    await userEvent.click(screen().getByRole("button", { name: "add" }));
    await settle();
    expect(screen().getByTestId("reg").tagName).toBe("SECTION");
    expect(screen().getByTestId("toast").tagName).toBe("ARTICLE");
    expect(screen().getByTestId("content").tagName).toBe("P");
    expect(screen().getByTestId("toast").textContent).toContain("Hi");
  });
});
