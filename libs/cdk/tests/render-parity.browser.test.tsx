// `render` prop review fixes (cdk render rollout, Tasks 5-7b):
// - outerHTML parity: `render` returning the same tag as the default element serializes the same DOM at mount and after one
//   interaction (attribute order normalised). Calendar / RangeCalendar / CalendarGrid / DateField / DatePicker compare the FULL
//   subtree (hidden a11y nodes, prompts, hidden inputs): their render branch duplicates the default branch's Provider + hidden
//   markup (see calendar/index.tsx), this test is what catches drift between the two.
// - Menu `react-aria-focus` / `react-aria-clear-focus` custom events on the render path (the spread's lowercased `on<Type>` keys,
//   libs/runtime/dom-v2-spread.ts ~L121).
// - `render` never leaks into the DOM as an attribute.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { waitFor, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { CalendarDate } from "@rivetjs/cdk/date";
import { Button } from "../button/index.tsx";
import { Autocomplete } from "../autocomplete/index.tsx";
import { SearchField } from "../search-field/index.tsx";
import { Input } from "../input/index.tsx";
import { Menu, MenuItem } from "../menu/index.tsx";
import { Tag, TagGroup, TagList } from "../tag-group/index.tsx";
import { GridList, GridListItem } from "../grid-list/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { Tree, TreeItem, TreeItemContent } from "../tree/index.tsx";
import { CheckboxField, CheckboxButton } from "../checkbox/index.tsx";
import { Switch } from "../switch/index.tsx";
import { Slider, SliderTrack, SliderThumb } from "../slider/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { Calendar, RangeCalendar, CalendarGrid, CalendarCell } from "../calendar/index.tsx";
import { DateField, DateInput, DateSegment } from "../date-field/index.tsx";
import { DatePicker } from "../date-picker/index.tsx";
import { Group } from "../group/index.tsx";
import { Form } from "../form/index.tsx";
import { Toolbar } from "../toolbar/index.tsx";
import { ToggleButtonGroup } from "../toggle-button-group/index.tsx";
import { ToggleButton } from "../toggle-button/index.tsx";
import { ProgressBar } from "../progress-bar/index.tsx";
import { Meter } from "../meter/index.tsx";
import { Breadcrumbs, Breadcrumb } from "../breadcrumbs/index.tsx";

afterEach(async () => {
  cleanup();
  await flush();
});

const user = userEvent.setup();
const FIXED = new CalendarDate(2024, 3, 10);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;
const settle = async () => {
  for (let i = 0; i < 3; i++) await flush();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await flush();
};
const maskId = (v: string) => v.replace(/\b(rv|react-aria)[a-z]*-?\d+\b/g, "<id>");
/** Subtree as text: attributes sorted, generated ids masked. */
const norm = (node: Node): string => {
  if (node.nodeType === 3) return (node.textContent ?? "").trim();
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const attrs = [...el.attributes]
    .map((a) => `${a.name}="${maskId(a.value)}"`)
    .sort()
    .join(" ");
  return `<${el.tagName.toLowerCase()} ${attrs}>${[...el.childNodes].map(norm).join("")}</${el.tagName.toLowerCase()}>`;
};
// The global live announcer (aria-live log) accumulates across mounts: left out.
const snapshot = () =>
  [...document.body.children]
    .filter((el) => !el.hasAttribute("data-live-announcer") && !el.hasAttribute("data-rv-announcer"))
    .map(norm)
    .join("");

type R = ((p: object) => unknown) | undefined;
interface Case {
  name: string;
  ui: (r: R) => unknown;
  /** The same-tag render function. */
  tag: (p: object) => unknown;
  /** One interaction; the element is found in `document`. */
  act?: () => Promise<void>;
}
const click = (selector: string) => async () => {
  await user.click(document.querySelector(selector) as Element);
  await settle();
};
const focus = (selector: string) => async () => {
  (document.querySelector(selector) as HTMLElement).focus();
  await settle();
};

const cases: Case[] = [
  {
    name: "CheckboxButton",
    tag: (p) => <label {...(p as {})} />,
    ui: (r) => (
      <CheckboxField>
        <CheckboxButton render={r as never}>
          <span>t</span>
        </CheckboxButton>
      </CheckboxField>
    ),
    act: click("label"),
  },
  { name: "Switch", tag: (p) => <label {...(p as {})} />, ui: (r) => <Switch render={r as never}>on</Switch>, act: click("label") },
  {
    name: "SliderThumb",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <Slider defaultValue={30} aria-label="s">
        <SliderTrack>
          <SliderThumb render={r as never} />
        </SliderTrack>
      </Slider>
    ),
    act: focus("input[type=range]"),
  },
  {
    name: "Tag",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <TagGroup aria-label="t" selectionMode="single">
        <TagList>
          <Tag id="a" render={r as never}>
            A
          </Tag>
        </TagList>
      </TagGroup>
    ),
    act: click("[role=row]"),
  },
  {
    name: "GridListItem",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <GridList aria-label="g" selectionMode="single">
        <GridListItem id="x" textValue="X" render={r as never}>
          X
        </GridListItem>
      </GridList>
    ),
    act: click("[role=row]"),
  },
  {
    name: "ListBoxItem",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <ListBox aria-label="l" selectionMode="single">
        <ListBoxItem id="x" textValue="X" render={r as never}>
          X
        </ListBoxItem>
      </ListBox>
    ),
    act: click("[role=option]"),
  },
  {
    name: "TreeItem",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <Tree aria-label="t" selectionMode="single">
        <TreeItem id="x" textValue="X" render={r as never}>
          <TreeItemContent>X</TreeItemContent>
        </TreeItem>
      </Tree>
    ),
    act: click("[role=row]"),
  },
  {
    name: "MenuItem",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <Menu aria-label="m">
        <MenuItem id="a" render={r as never}>
          A
        </MenuItem>
      </Menu>
    ),
    act: focus("[role=menu]"),
  },
  {
    name: "Popover",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <DialogTrigger defaultOpen>
        <Button>t</Button>
        <Popover render={r as never}>
          <Dialog aria-label="d">Popover</Dialog>
        </Popover>
      </DialogTrigger>
    ),
    act: async () => {
      await user.keyboard("{Escape}");
      await settle();
    },
  },
  {
    name: "Calendar",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c" render={r as never}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    ),
    act: click("td[role=gridcell]:not([aria-disabled=true]) [role=button]"),
  },
  {
    name: "RangeCalendar",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <RangeCalendar defaultFocusedValue={FIXED} aria-label="c" render={r as never}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </RangeCalendar>
    ),
    act: click("td[role=gridcell]:not([aria-disabled=true]) [role=button]"),
  },
  {
    name: "CalendarGrid",
    tag: (p) => <table {...(p as {})} />,
    ui: (r) => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c">
        <CalendarGrid render={r as never}>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    ),
    act: click("td[role=gridcell]:not([aria-disabled=true]) [role=button]"),
  },
  {
    name: "DateField",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <DateField aria-label="d" name="d" defaultValue={FIXED} render={r as never}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
    ),
    act: focus("[role=spinbutton]"),
  },
  {
    name: "DatePicker",
    tag: (p) => <div {...(p as {})} />,
    ui: (r) => (
      <DatePicker aria-label="p" name="p" defaultValue={FIXED} render={r as never}>
        <Group>
          <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
          <Button>o</Button>
        </Group>
        <Popover>
          <Dialog>
            <Calendar />
          </Dialog>
        </Popover>
      </DatePicker>
    ),
    act: click("button"),
  },
];

describe("render prop: outerHTML parity with the default element", () => {
  // Global state (input modality, announcers) settles on the first interaction of the file: warm it up once.
  it("warm-up", async () => {
    mount(() => <Switch>w</Switch>);
    await user.click(document.querySelector("label")!);
    await settle();
  });

  for (const c of cases) {
    it(`${c.name}: same DOM at mount and after one interaction`, async () => {
      // Pointer modality is global: both runs start from the same (pointer) state.
      await user.click(document.body);
      mount(() => c.ui(undefined));
      await settle();
      const defMount = snapshot();
      await c.act?.();
      const defAfter = snapshot();
      cleanup();
      await flush();
      mount(() => c.ui(c.tag));
      await settle();
      expect(snapshot()).toBe(defMount);
      await c.act?.();
      expect(snapshot()).toBe(defAfter);
    });
  }
});

describe("render prop: Menu virtual-focus custom events", () => {
  // Menu inside an Autocomplete takes virtual focus through `react-aria-focus` / `react-aria-clear-focus` CustomEvents. On the
  // render path they are attrs keyed `onReact-aria-focus` / `onReact-aria-clear-focus` (dom-v2-spread.ts lowercases the type
  // after `on` and binds non-delegated types with addEventListener).
  const ui = () => (
    <Autocomplete filter={(text: string, input: string) => text.toLowerCase().includes(input.toLowerCase())}>
      <SearchField aria-label="Search">
        <Input />
      </SearchField>
      <Menu aria-label="Commands" render={(p) => <section {...(p as {})} />}>
        <MenuItem id="foo">Foo</MenuItem>
        <MenuItem id="bar">Bar</MenuItem>
      </Menu>
    </Autocomplete>
  );

  it("react-aria-focus (from the input's arrow keys) moves virtual focus, react-aria-clear-focus clears it", async () => {
    const c = mount(ui);
    await flush();
    const menu = c.querySelector("[role=menu]") as HTMLElement;
    expect(menu.tagName).toBe("SECTION");
    const input = within(c).getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    const items = within(menu).getAllByRole("menuitem");
    await waitFor(() => expect(input).toHaveAttribute("aria-activedescendant", items[0]!.id));
    expect(items[0]).toHaveAttribute("data-focused", "true");
    // Dispatched directly on the rendered element.
    menu.dispatchEvent(new CustomEvent("react-aria-clear-focus", { bubbles: true, cancelable: true, detail: { clearFocusKey: true } }));
    await waitFor(() => expect(items[0]).not.toHaveAttribute("data-focused"));
    menu.dispatchEvent(new CustomEvent("react-aria-focus", { bubbles: true, cancelable: true, detail: { focusStrategy: "first" } }));
    await flush();
    expect(menu.getAttribute("tabindex")).toBeNull();
  });

  it("menu items and menu carry no tabindex (virtual focus) on the render path", async () => {
    const c = mount(ui);
    await flush();
    expect(c.querySelector("[role=menu]")).not.toHaveAttribute("tabindex");
    for (const item of c.querySelectorAll("[role=menuitem]")) expect(item).not.toHaveAttribute("tabindex");
  });
});

describe("render prop: never a DOM attribute", () => {
  it("no rendered element carries a `render` attribute (every render part)", async () => {
    const r = (p: object) => <div {...(p as {})} />;
    const section = (p: object) => <section {...(p as {})} />;
    mount(() => (
      <>
        <Group render={r as never}>g</Group>
        <Form aria-label="f" render={section as never}>
          <Input />
        </Form>
        <ToggleButtonGroup render={r as never}>
          <ToggleButton id="a">a</ToggleButton>
        </ToggleButtonGroup>
        <Toolbar aria-label="tb" render={r as never}>
          <Button render={r as never}>b</Button>
        </Toolbar>
        <ProgressBar value={1} aria-label="p" render={r as never} />
        <Meter value={1} aria-label="m" render={r as never} />
        <Breadcrumbs render={r as never}>
          <Breadcrumb render={r as never} />
        </Breadcrumbs>
        <TagGroup aria-label="t" render={r as never}>
          <TagList render={r as never}>
            <Tag id="a" render={r as never}>
              A
            </Tag>
          </TagList>
        </TagGroup>
        <GridList aria-label="g" render={r as never}>
          <GridListItem id="x" textValue="X" render={r as never}>
            X
          </GridListItem>
        </GridList>
        <ListBox aria-label="l" render={r as never}>
          <ListBoxItem id="x" textValue="X" render={r as never}>
            X
          </ListBoxItem>
        </ListBox>
        <Tree aria-label="tr" render={r as never}>
          <TreeItem id="x" textValue="X" render={r as never}>
            <TreeItemContent>X</TreeItemContent>
          </TreeItem>
        </Tree>
        <Menu aria-label="m" render={r as never}>
          <MenuItem id="a" render={r as never}>
            A
          </MenuItem>
        </Menu>
        <Calendar defaultFocusedValue={FIXED} aria-label="c" render={r as never}>
          <CalendarGrid render={r as never}>{(date) => <CalendarCell date={date} render={r as never} />}</CalendarGrid>
        </Calendar>
        <DateField aria-label="d" defaultValue={FIXED} render={r as never}>
          <DateInput render={r as never}>{(segment) => <DateSegment segment={segment} render={r as never} />}</DateInput>
        </DateField>
        <DatePicker aria-label="p" render={r as never} />
        <Switch render={r as never}>s</Switch>
        <Slider defaultValue={1} aria-label="s" render={r as never}>
          <SliderTrack render={r as never}>
            <SliderThumb render={r as never} />
          </SliderTrack>
        </Slider>
        <DialogTrigger defaultOpen>
          <Button>t</Button>
          <Popover render={r as never}>
            <Dialog aria-label="d" render={r as never}>
              x
            </Dialog>
          </Popover>
        </DialogTrigger>
      </>
    ));
    await settle();
    const bad = [...document.body.querySelectorAll("*")].filter((el) => el.hasAttribute("render") || el.hasAttribute("onrender"));
    expect(bad.map((el) => el.tagName)).toEqual([]);
  });
});
