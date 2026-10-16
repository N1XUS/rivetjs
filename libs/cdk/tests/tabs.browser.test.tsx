// Ported from react-aria-components test/Tabs.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries from `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isHovered()`); `jest.fn` → `vi.fn`; `userEvent.setup()` (real
// timers: the tooltip uses `delay={0}`); `React.createRef` → `ref()`; default classes `rv-*`; `useState` → signals
// (`selectedKey` two-way); TabPanel content of unselected tabs as render-function children where it is shown later;
// the RTL case puts the tabs in a `dir="rtl"` element (Rivet's TabsKeyboardDelegate reads the DOM direction, not the
// I18nProvider locale); "navigate linked tabs on click" fires pointer events (Rivet's usePress is pointer-only, no
// mouse-event fallback); "supports Activity" (React 19 Activity) is not ported.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, waitFor, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { ComboBox } from "../combobox/index.tsx";
import { DialogTrigger } from "../dialog/index.tsx";
import { Input } from "../input/index.tsx";
import { Label } from "../label/index.tsx";
import { ListBox, ListBoxItem } from "../listbox/index.tsx";
import { Menu, MenuItem, MenuTrigger } from "../menu/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Select, SelectValue } from "../select/index.tsx";
import { Tooltip, TooltipTrigger } from "../tooltip/index.tsx";
import { RouterProvider } from "../utils/links.tsx";
import { Tab, TabList, TabPanel, TabPanels, Tabs, type Key, type TabListProps, type TabPanelProps, type TabProps, type TabsProps } from "../tabs/index.tsx";

afterEach(cleanup);

const renderIt = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);

const renderTabs = (
  tabsProps: Partial<TabsProps> = {},
  tablistProps: Partial<TabListProps> = {},
  tabProps: Partial<TabProps> = {},
  tabpanelProps: Partial<TabPanelProps> = {},
) =>
  renderIt(() => (
    <Tabs {...tabsProps} data-testid="tabs-wrapper">
      <TabList {...tablistProps} aria-label="Test">
        <Tab {...tabProps} id="a">
          A
        </Tab>
        <Tab {...tabProps} id="b">
          B
        </Tab>
        <Tab {...tabProps} id="c">
          C
        </Tab>
      </TabList>
      <TabPanel {...tabpanelProps} id="a">
        {() => "A"}
      </TabPanel>
      <TabPanel {...tabpanelProps} id="b">
        {() => "B"}
      </TabPanel>
      <TabPanel {...tabpanelProps} id="c">
        {() => "C"}
      </TabPanel>
    </Tabs>
  ));

describe("Tabs", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) });
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render tabs with default classes", () => {
    const { getByTestId } = renderTabs();
    const tabs = getByTestId("tabs-wrapper");
    const tabsTester = testUtilUser.createTester("Tabs", { root: tabs });
    const tablist = tabsTester.getTablist();
    expect(tabs).toBeInTheDocument();
    expect(tabs).toHaveAttribute("class", "rv-Tabs");
    expect(tablist).toHaveAttribute("class", "rv-TabList");
    expect(tablist).toHaveAttribute("aria-label", "Test");
    for (const tab of tabsTester.getTabs()) expect(tab).toHaveAttribute("class", "rv-Tab");
    expect(tabsTester.getTabpanels()[0]).toHaveAttribute("class", "rv-TabPanel");
  });

  it("should render tabs with custom classes", () => {
    const { getByRole, getAllByRole } = renderTabs({ class: "tabs" }, { class: "tablist" }, { class: "tab" }, { class: "tabpanel" });
    const tablist = getByRole("tablist");
    const tabs = tablist.closest(".tabs");
    expect(tabs).toBeInTheDocument();
    expect(tablist).toHaveAttribute("class", "tablist");
    for (const tab of getAllByRole("tab")) expect(tab).toHaveAttribute("class", "tab");
    const tabpanel = getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("class", "tabpanel");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderTabs({ "data-test": "tabs" }, { "data-test": "tablist" }, { "data-test": "tab" }, { "data-test": "tabpanel" });
    const tablist = getByRole("tablist");
    const tabs = tablist.closest(".rv-Tabs");
    expect(tabs).toHaveAttribute("data-test", "tabs");
    expect(tablist).toHaveAttribute("data-test", "tablist");
    for (const tab of getAllByRole("tab")) expect(tab).toHaveAttribute("data-test", "tab");
    const tabpanel = getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("data-test", "tabpanel");
  });

  it("should support aria props on the tabs", () => {
    const { getAllByRole } = renderTabs(
      {},
      {},
      {
        "aria-label": "label",
        "aria-labelledby": "labelledby",
        "aria-describedby": "describedby",
        "aria-details": "details",
      },
      {},
    );
    for (const tab of getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-label", "label");
      expect(tab).toHaveAttribute("aria-labelledby", "labelledby");
      expect(tab).toHaveAttribute("aria-describedby", "describedby");
      expect(tab).toHaveAttribute("aria-details", "details");
    }
  });

  it("should support custom render function", () => {
    const { getAllByRole, getByRole } = renderTabs(
      { render: (props) => <div {...props} data-custom="true" /> },
      { render: (props) => <div {...props} data-custom="true" /> },
      { render: (props) => <div {...props} data-custom="true" /> },
      { render: (props) => <div {...props} data-custom="true" /> },
    );
    const tablist = getByRole("tablist");
    const tabs = tablist.closest(".rv-Tabs");
    expect(tabs).toHaveAttribute("data-custom", "true");
    expect(tablist).toHaveAttribute("data-custom", "true");
    for (const tab of getAllByRole("tab")) expect(tab).toHaveAttribute("data-custom", "true");
    const tabpanel = getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("data-custom", "true");
  });

  it("should support custom render function as a link", () => {
    const { getAllByRole, getByRole } = renderTabs(
      { render: (props) => <div {...props} data-custom="true" /> },
      { render: (props) => <div {...props} data-custom="true" /> },
      { href: "#foo", render: (props) => <a {...(props as Record<string, any>)} data-custom="true" /> },
      { render: (props) => <div {...props} data-custom="true" /> },
    );
    const tablist = getByRole("tablist");
    const tabs = tablist.closest(".rv-Tabs");
    expect(tabs).toHaveAttribute("data-custom", "true");
    expect(tablist).toHaveAttribute("data-custom", "true");
    for (const tab of getAllByRole("tab")) {
      expect(tab).toHaveAttribute("href");
      expect(tab).toHaveAttribute("data-custom", "true");
    }
    const tabpanel = getByRole("tabpanel");
    expect(tabpanel).toHaveAttribute("data-custom", "true");
  });

  it("should support render props", () => {
    const { getByRole } = renderIt(() => (
      <Tabs orientation="horizontal">
        {({ orientation }: { orientation: () => string }) => (
          <>
            <TabList aria-label={`Test ${orientation()}`}>
              <Tab id="a">A</Tab>
              <Tab id="b">B</Tab>
              <Tab id="c">C</Tab>
            </TabList>
            <TabPanel id="a">A</TabPanel>
            <TabPanel id="b">B</TabPanel>
            <TabPanel id="c">C</TabPanel>
          </>
        )}
      </Tabs>
    ));
    const tablist = getByRole("tablist");
    expect(tablist).toHaveAttribute("aria-label", "Test horizontal");
  });

  it("should support hover", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTabs({}, {}, { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd });
    const tab = getAllByRole("tab")[0]!;

    expect(tab).not.toHaveAttribute("data-hovered");
    expect(tab).not.toHaveClass("hover");

    await user.hover(tab);
    expect(tab).toHaveAttribute("data-hovered", "true");
    expect(tab).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(1);

    await user.unhover(tab);
    expect(tab).not.toHaveAttribute("data-hovered");
    expect(tab).not.toHaveClass("hover");
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
  });

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTabs(
      { disabledKeys: ["a", "b", "c"] },
      {},
      { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd },
    );
    const tab = getAllByRole("tab")[0]!;

    expect(tab).not.toHaveAttribute("data-hovered");
    expect(tab).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();

    await user.hover(tab);
    expect(tab).not.toHaveAttribute("data-hovered");
    expect(tab).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it("should support focus ring", async () => {
    const onFocus = vi.fn();
    const onFocusChange = vi.fn();
    const onBlur = vi.fn();
    const { getAllByRole } = renderTabs({}, {}, { class: ({ isFocusVisible }) => (isFocusVisible() ? "focus" : ""), onFocus, onFocusChange, onBlur });
    const tab = getAllByRole("tab")[0]!;

    expect(tab).not.toHaveAttribute("data-focus-visible");
    expect(tab).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(tab);
    expect(tab).toHaveAttribute("data-focus-visible", "true");
    expect(tab).toHaveAttribute("data-focused", "true");
    expect(tab).toHaveClass("focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();
    onFocus.mockClear();
    onFocusChange.mockClear();
    onBlur.mockClear();

    await user.tab();
    expect(tab).not.toHaveAttribute("data-focus-visible");
    expect(tab).not.toHaveClass("focus");
    expect(onFocus).not.toHaveBeenCalled();
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderTabs({}, {}, { class: ({ isPressed }) => (isPressed() ? "pressed" : "") });
    const tab = getAllByRole("tab")[0]!;

    expect(tab).not.toHaveAttribute("data-pressed");
    expect(tab).not.toHaveClass("pressed");

    await user.pointer({ target: tab, keys: "[MouseLeft>]" });
    expect(tab).toHaveAttribute("data-pressed", "true");
    expect(tab).toHaveClass("pressed");

    await user.pointer({ target: tab, keys: "[/MouseLeft]" });
    expect(tab).not.toHaveAttribute("data-pressed");
    expect(tab).not.toHaveClass("pressed");
  });

  it("should support disabled state on all tabs", () => {
    const { getAllByRole } = renderTabs({ isDisabled: true }, {}, { class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") });
    const tab = getAllByRole("tab")[0]!;
    expect(tab).toHaveAttribute("aria-disabled", "true");
    expect(tab).toHaveClass("disabled");
  });

  it("should support disabled state on tab", () => {
    const { getAllByRole } = renderTabs({ disabledKeys: ["a"] }, {}, { class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") });
    const tab = getAllByRole("tab")[0]!;
    expect(tab).toHaveAttribute("aria-disabled", "true");
    expect(tab).toHaveClass("disabled");
  });

  it("should support isDisabled prop on tab", async () => {
    const { getAllByRole } = renderIt(() => (
      <Tabs>
        <TabList aria-label="Test">
          <Tab id="a">A</Tab>
          <Tab id="b" isDisabled>
            B
          </Tab>
          <Tab id="c">C</Tab>
        </TabList>
        <TabPanel id="a">A</TabPanel>
        <TabPanel id="b">{() => "B"}</TabPanel>
        <TabPanel id="c">{() => "C"}</TabPanel>
      </Tabs>
    ));
    const items = getAllByRole("tab");
    expect(items[1]).toHaveAttribute("aria-disabled", "true");

    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[2]);
  });

  it("finds the first non-disabled tab", async () => {
    const { getAllByRole } = renderIt(() => (
      <Tabs>
        <TabList aria-label="Test">
          <Tab id="a" isDisabled>
            A
          </Tab>
          <Tab id="b">B</Tab>
          <Tab id="c">C</Tab>
        </TabList>
        <TabPanel id="a">{() => "A"}</TabPanel>
        <TabPanel id="b">B</TabPanel>
        <TabPanel id="c">{() => "C"}</TabPanel>
      </Tabs>
    ));
    const items = getAllByRole("tab");
    expect(items[0]).toHaveAttribute("aria-disabled", "true");

    await user.tab();
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[2]);
  });

  it("selects first tab if all tabs are disabled", async () => {
    const { getByRole } = renderTabs({}, {}, { isDisabled: true });
    const tabsTester = testUtilUser.createTester("Tabs", { root: getByRole("tablist") });
    await user.tab();

    expect(tabsTester.getSelectedTab()).toBe(tabsTester.getTabs()[0]);
    expect(document.activeElement).toBe(tabsTester.getTabpanels()[0]);
  });

  it("should support selected state", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole } = renderTabs({ onSelectionChange }, {}, { class: ({ isSelected }) => (isSelected() ? "selected" : "") });
    const tabsTester = testUtilUser.createTester("Tabs", { root: getByRole("tablist") });
    const tabs = tabsTester.getTabs();

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveClass("selected");

    await tabsTester.triggerTab({ tab: 1 });
    expect(onSelectionChange).toHaveBeenLastCalledWith("b");
    expect(tabs[0]).not.toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).not.toHaveClass("selected");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveClass("selected");

    await tabsTester.triggerTab({ tab: 0 });
    expect(onSelectionChange).toHaveBeenLastCalledWith("a");
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveClass("selected");
  });

  it("should update TabPanel ID when current tab is changed", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole } = renderIt(() => (
      <Tabs onSelectionChange={onSelectionChange}>
        <TabList>
          <Tab id="first-element">First</Tab>
          <Tab id="second-element">Second</Tab>
          <Tab id="third-element">Third</Tab>
        </TabList>
        <TabPanel id="first-element">First</TabPanel>
        <TabPanel id="second-element">{() => "Second"}</TabPanel>
        <TabPanel id="third-element">{() => "Third"}</TabPanel>
      </Tabs>
    ));

    const tabsTester = testUtilUser.createTester("Tabs", { root: getByRole("tablist") });
    expect(tabsTester.getActiveTabpanel()!.getAttribute("id")).toContain("first-element");

    await tabsTester.triggerTab({ tab: 1 });
    expect(onSelectionChange).toHaveBeenCalled();
    expect(tabsTester.getActiveTabpanel()!.getAttribute("id")).toContain("second-element");

    await tabsTester.triggerTab({ tab: 2 });
    expect(onSelectionChange).toHaveBeenCalled();
    expect(tabsTester.getActiveTabpanel()!.getAttribute("id")).toContain("third-element");
  });

  it("should support orientation", () => {
    const className = ({ orientation }: { orientation: () => string }) => orientation();
    const { getByRole } = renderTabs({ orientation: "vertical", class: className }, { class: className });
    const tablist = getByRole("tablist");
    const tabs = tablist.parentElement;

    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
    expect(tablist).toHaveClass("vertical");

    expect(tabs).toHaveAttribute("data-orientation", "vertical");
    expect(tabs).toHaveClass("vertical");
  });

  it("allows user to change tab item selection via arrow keys with vertical tabs (rtl)", async () => {
    const { getByRole } = renderIt(() => (
      <div dir="rtl">
        <Tabs orientation="vertical">
          <TabList aria-label="Test">
            <Tab id="a">A</Tab>
            <Tab id="b">B</Tab>
            <Tab id="c">C</Tab>
          </TabList>
          <TabPanel id="a">{() => "A"}</TabPanel>
          <TabPanel id="b">{() => "B"}</TabPanel>
          <TabPanel id="c">{() => "C"}</TabPanel>
        </Tabs>
      </div>
    ));

    const tablist = getByRole("tablist");
    const tabs = within(tablist).getAllByRole("tab");
    const selectedItem = tabs[0];
    await user.tab();

    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
    expect(selectedItem).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowDown}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(selectedItem).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(selectedItem).toHaveAttribute("aria-selected", "true");
  });

  it.each(["mouse", "keyboard", "touch"] as const)(
    "should support changing the selected tab regardless of interaction type, interactionType: %s ",
    async (interactionType) => {
      const { getByRole } = renderTabs({ orientation: "vertical" });
      const tabsTester = testUtilUser.createTester("Tabs", { root: getByRole("tablist"), interactionType });
      const tabs = tabsTester.getTabs();

      await tabsTester.triggerTab({ tab: 0 });
      expect(tabsTester.getSelectedTab()).toBe(tabs[0]);
      expect(tabsTester.getActiveTabpanel()!.getAttribute("aria-labelledby")).toBe(tabs[0]!.id);

      await tabsTester.triggerTab({ tab: 1 });
      expect(tabsTester.getSelectedTab()).toBe(tabs[1]);
      expect(tabsTester.getActiveTabpanel()!.getAttribute("aria-labelledby")).toBe(tabs[1]!.id);

      await tabsTester.triggerTab({ tab: 2 });
      expect(tabsTester.getSelectedTab()).toBe(tabs[2]);
      expect(tabsTester.getActiveTabpanel()!.getAttribute("aria-labelledby")).toBe(tabs[2]!.id);

      await tabsTester.triggerTab({ tab: 1 });
      expect(tabsTester.getSelectedTab()).toBe(tabs[1]);
      expect(tabsTester.getActiveTabpanel()!.getAttribute("aria-labelledby")).toBe(tabs[1]!.id);
    },
  );

  it("should support refs", () => {
    const tabsRef = ref<HTMLDivElement>();
    const tabListRef = ref<HTMLDivElement>();
    const tabRef = ref<HTMLElement>();
    const tabPanelRef = ref<HTMLDivElement>();
    render((() => (
      <Tabs ref={tabsRef}>
        <TabList ref={tabListRef}>
          <Tab id="a" ref={tabRef}>
            A
          </Tab>
          <Tab id="b">B</Tab>
          <Tab id="c">C</Tab>
        </TabList>
        <TabPanel id="a" ref={tabPanelRef}>
          A
        </TabPanel>
        <TabPanel id="b">{() => "B"}</TabPanel>
        <TabPanel id="c">{() => "C"}</TabPanel>
      </Tabs>
    )) as never);
    expect(tabsRef()).toBeInstanceOf(HTMLElement);
    expect(tabListRef()).toBeInstanceOf(HTMLElement);
    expect(tabRef()).toBeInstanceOf(HTMLElement);
    expect(tabPanelRef()).toBeInstanceOf(HTMLElement);
  });

  it("should support shouldForceMount", async () => {
    const { getAllByRole } = renderTabs({}, {}, {}, { shouldForceMount: true });
    const tabpanels = document.querySelectorAll(".rv-TabPanel");
    expect(tabpanels).toHaveLength(3);
    expect(tabpanels[0]).not.toHaveAttribute("inert");
    expect(tabpanels[1]).toHaveAttribute("inert");
    expect(tabpanels[2]).toHaveAttribute("inert");

    const tabs = getAllByRole("tab");
    await user.click(tabs[1]!);

    expect(tabpanels[0]).toHaveAttribute("inert");
    expect(tabpanels[1]).not.toHaveAttribute("inert");
    expect(tabpanels[2]).toHaveAttribute("inert");
  });

  it("should support keyboardActivation=manual", async () => {
    const onSelectionChange = vi.fn();
    const { getByRole } = renderTabs({ keyboardActivation: "manual", onSelectionChange, defaultSelectedKey: "a" });
    const tabsTester = testUtilUser.createTester("Tabs", { root: getByRole("tablist"), interactionType: "keyboard" });

    const tabs = tabsTester.getTabs();
    await tabsTester.triggerTab({ tab: 0 });

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await tabsTester.triggerTab({ tab: 1 });
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(document.activeElement).toBe(tabs[1]);
    await tabsTester.triggerTab({ tab: 2 });
    expect(tabs[2]).toHaveAttribute("aria-selected", "false");
    expect(document.activeElement).toBe(tabs[2]);
    await tabsTester.triggerTab({ tab: 2, manualActivation: true });
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  // RAC stories/Tabs.stories.tsx TabsExample: link tabs whose selection follows the router's URL.
  const TabsExample = () => {
    const url = signal<Key | null>("/FoR");
    return (
      <RouterProvider navigate={(href) => url.set(href)}>
        <Tabs selectedKey={url}>
          <TabList aria-label="History of Ancient Rome" style={{ display: "flex", gap: "8px" }}>
            <Tab id="/FoR" href="/FoR">
              Founding of Rome
            </Tab>
            <Tab id="/MaR" href="/MaR">
              Monarchy and Republic
            </Tab>
            <TooltipTrigger>
              <Tab id="/Emp" href="/Emp">
                Empire
              </Tab>
              <Tooltip offset={5}>I am a tooltip</Tooltip>
            </TooltipTrigger>
          </TabList>
          <TabPanel id="/FoR">{() => "Arma virumque cano, Troiae qui primus ab oris."}</TabPanel>
          <TabPanel id="/MaR">{() => "Senatus Populusque Romanus."}</TabPanel>
          <TabPanel id="/Emp">{() => "Alea jacta est."}</TabPanel>
        </Tabs>
      </RouterProvider>
    );
  };

  it("should support tabs as links", async function () {
    const { getAllByRole } = renderIt(() => <TabsExample />);

    const tabs = getAllByRole("tab");
    expect(tabs[0]!.tagName).toBe("A");
    expect(tabs[0]).toHaveAttribute("href", "/FoR");
    expect(tabs[1]!.tagName).toBe("A");
    expect(tabs[1]).toHaveAttribute("href", "/MaR");
    expect(tabs[2]!.tagName).toBe("A");
    expect(tabs[2]).toHaveAttribute("href", "/Emp");

    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await user.click(tabs[1]!);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tabs[1]!, { key: "ArrowRight" });
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("should navigate linked tabs on click rather than mouse down", async function () {
    const navigate = vi.fn();
    const { getAllByRole } = renderIt(() => (
      <RouterProvider navigate={navigate}>
        <Tabs selectedKey="/a">
          <TabList aria-label="Test">
            <Tab id="/a" href="/a">
              A
            </Tab>
            <Tab id="/b" href="/b">
              B
            </Tab>
          </TabList>
          <TabPanel id="/a">A</TabPanel>
          <TabPanel id="/b">{() => "B"}</TabPanel>
        </Tabs>
      </RouterProvider>
    ));

    const tabs = getAllByRole("tab");
    const pointer = { button: 0, detail: 1, pointerId: 1, pointerType: "mouse", isPrimary: true };
    fireEvent.pointerDown(tabs[1]!, pointer);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.pointerLeave(tabs[1]!, pointer);
    fireEvent.pointerEnter(tabs[1]!, pointer);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.pointerUp(tabs[1]!, pointer);
    fireEvent.click(tabs[1]!, { button: 0, detail: 1 });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/b", undefined);
  });

  it("should render tab with aria-label", () => {
    const { getAllByRole } = renderIt(() => (
      <Tabs>
        <TabList>
          <Tab id="a" aria-label="Tab A">
            A
          </Tab>
          <Tab id="b" aria-label="Tab B">
            B
          </Tab>
          <Tab id="c" aria-label="Tab C">
            C
          </Tab>
        </TabList>
        <TabPanel id="a">A</TabPanel>
        <TabPanel id="b">{() => "B"}</TabPanel>
        <TabPanel id="c">{() => "C"}</TabPanel>
      </Tabs>
    ));

    const tabs = getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-label", "Tab A");
    expect(tabs[1]).toHaveAttribute("aria-label", "Tab B");
    expect(tabs[2]).toHaveAttribute("aria-label", "Tab C");
  });

  it("supports nested tabs", async () => {
    const { getAllByRole } = renderIt(() => (
      <Tabs>
        <TabList>
          <Tab id="foo">Foo</Tab>
          <Tab id="bar">Bar</Tab>
        </TabList>
        <TabPanel id="foo">
          <Tabs>
            <TabList>
              <Tab id="one">One</Tab>
              <Tab id="two">Two</Tab>
            </TabList>
            <TabPanel id="one">One</TabPanel>
            <TabPanel id="two">{() => "Two"}</TabPanel>
          </Tabs>
        </TabPanel>
        <TabPanel id="bar">{() => "Bar"}</TabPanel>
      </Tabs>
    ));

    await waitFor(() => Promise.resolve());

    const rootTabs = within(getAllByRole("tablist")[0]!).getAllByRole("tab");
    expect(rootTabs).toHaveLength(2);
    expect(rootTabs[0]).toHaveTextContent("Foo");
    expect(rootTabs[1]).toHaveTextContent("Bar");

    const innerTabs = within(getAllByRole("tabpanel")[0]!).getAllByRole("tab");
    expect(innerTabs).toHaveLength(2);
    expect(innerTabs[0]).toHaveTextContent("One");
    expect(innerTabs[1]).toHaveTextContent("Two");
  });

  it("can add tabs and keep the current selected key", async () => {
    const onSelectionChange = vi.fn();
    const Example = (props: { onSelectionChange: (key: Key) => void }) => {
      const tabs = signal([
        { id: 1, title: "Tab 1", content: "Tab body 1" },
        { id: 2, title: "Tab 2", content: "Tab body 2" },
        { id: 3, title: "Tab 3", content: "Tab body 3" },
      ]);
      const selectedTabId = signal<Key | null>(tabs()[0]!.id);
      const notify = props.onSelectionChange;
      const addTab = () => {
        const tabId = tabs().length + 1;
        tabs.set([...tabs(), { id: tabId, title: `Tab ${tabId}`, content: `Tab body ${tabId}` }]);
        selectedTabId.set(tabId);
      };
      const removeTab = () => {
        if (tabs().length > 1) {
          const updatedTabs = tabs().slice(0, -1);
          selectedTabId.set(updatedTabs[updatedTabs.length - 1]!.id);
          tabs.set(updatedTabs);
        }
      };
      return (
        <Tabs selectedKey={selectedTabId} onSelectionChange={(value) => notify(value)}>
          <div style={{ display: "flex" }}>
            <TabList aria-label="Dynamic tabs" items={tabs} style={{ flex: 1 }}>
              {(item: { id: number; title: string }) => (
                <Tab>{({ isSelected }: { isSelected: () => boolean }) => <p style={{ color: isSelected() ? "red" : "black" }}>{item.title}</p>}</Tab>
              )}
            </TabList>
            <div class="button-group">
              <Button onPress={addTab}>Add tab</Button>
              <Button onPress={removeTab}>Remove tab</Button>
            </div>
          </div>
          <TabPanels items={tabs}>
            {(item: { content: string }) => <TabPanel style={{ borderTop: "2px solid black" }}>{() => item.content}</TabPanel>}
          </TabPanels>
        </Tabs>
      );
    };
    const { getAllByRole } = renderIt(() => <Example onSelectionChange={onSelectionChange} />);
    let tabs = getAllByRole("tab");
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.tab();
    onSelectionChange.mockClear();
    await user.keyboard("{Enter}");
    await flush();
    expect(onSelectionChange).not.toHaveBeenCalled();
    tabs = getAllByRole("tab");
    expect(tabs[3]).toHaveAttribute("aria-selected", "true");

    await user.tab();
    await user.keyboard("{Enter}");
    await flush();
    expect(onSelectionChange).not.toHaveBeenCalled();
    tabs = getAllByRole("tab");
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
  });

  it("should support tabpanels with aria-labels", () => {
    const { getByTestId } = renderIt(() => (
      <Tabs>
        <TabList aria-label="test">
          <Tab id="a">A</Tab>
          <Tab id="b">B</Tab>
        </TabList>
        <TabPanels aria-label="test" data-testid="tabpanels">
          <TabPanel id="a">A</TabPanel>
          <TabPanel id="b">{() => "B"}</TabPanel>
        </TabPanels>
      </Tabs>
    ));

    const tabPanels = getByTestId("tabpanels");
    expect(tabPanels).toHaveAttribute("aria-label", "test");
  });

  it("should support tabpanels with custom styles", () => {
    const { getByTestId } = renderIt(() => (
      <Tabs>
        <TabList aria-label="test">
          <Tab id="a">A</Tab>
          <Tab id="b">B</Tab>
        </TabList>
        <TabPanels style={{ width: "100px" }} data-testid="tabpanels">
          <TabPanel id="a">A</TabPanel>
          <TabPanel id="b">{() => "B"}</TabPanel>
        </TabPanels>
      </Tabs>
    ));

    const tabPanels = getByTestId("tabpanels");
    expect(tabPanels).toHaveStyle({ width: "100px" });
  });

  for (const [property, variable] of [
    ["block-size", "--tab-panel-height"],
    ["inline-size", "--tab-panel-width"],
  ] as const) {
    it(`should detect ${property} in transition for TabPanels`, async () => {
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = ((el: Element) => ({ ...originalGetComputedStyle(el), transition: `${property} 400ms ease` })) as never;
      try {
        const { getByTestId } = renderIt(() => (
          <Tabs>
            <TabList aria-label="test">
              <Tab id="a">A</Tab>
              <Tab id="b">B</Tab>
            </TabList>
            <TabPanels data-testid="tabpanels">
              <TabPanel id="a">A</TabPanel>
              <TabPanel id="b">{() => "B"}</TabPanel>
            </TabPanels>
          </Tabs>
        ));
        await flush();
        const tabs = document.querySelectorAll<HTMLElement>('[role="tab"]');
        await user.click(tabs[1]!);
        await flush();
        expect(getByTestId("tabpanels").style.getPropertyValue(variable)).not.toBe("");
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    });
  }

  it("supports tooltips", async function () {
    const { getAllByRole } = renderIt(() => (
      <Tabs>
        <TabList aria-label="Test">
          <Tab id="a">A</Tab>
          <Tab id="b">B</Tab>
          <TooltipTrigger delay={0}>
            <Tab id="c">C</Tab>
            <Tooltip>Test</Tooltip>
          </TooltipTrigger>
        </TabList>
        <TabPanel id="a">A</TabPanel>
        <TabPanel id="b">{() => "B"}</TabPanel>
        <TabPanel id="c">{() => "C"}</TabPanel>
      </Tabs>
    ));

    const tab = getAllByRole("tab")[2]!;
    fireEvent.mouseMove(document.body);
    await user.hover(tab);
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toHaveTextContent("Test"));
  });

  describe("press events", () => {
    it.each(["mouse", "keyboard"] as const)("should support press events on items when using %s", async function (interactionType) {
      const onPressStart = vi.fn();
      const onPressEnd = vi.fn();
      const onPress = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = renderTabs({ keyboardActivation: "manual" }, {}, { onPressStart, onPressEnd, onPress, onClick });
      const tester = testUtilUser.createTester("Tabs", { root: getByRole("tablist") });
      await tester.triggerTab({ tab: 1, interactionType, manualActivation: true });

      expect(onPressStart).toHaveBeenCalledTimes(1);
      expect(onPressEnd).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  it("supports Menu inside Tabs", async () => {
    const tree = renderIt(() => (
      <Tabs>
        <div>
          <TabList>
            <Tab id="key1">First Tab</Tab>
            <Tab id="key2">Second Tab</Tab>
          </TabList>
          <MenuTrigger>
            <Button>Menu button</Button>
            <Popover>
              <Menu>
                <MenuItem>Item 1</MenuItem>
                <MenuItem>Item 2</MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <TabPanel id="key1">First Tab content</TabPanel>
        <TabPanel id="key2">{() => "Second Tab content"}</TabPanel>
      </Tabs>
    ));

    const tester = testUtilUser.createTester("Tabs", { root: tree.getByRole("tablist") });
    expect(tester.getTabs().length).toBe(2);

    const trigger = tree.getByRole("button");
    const menu = testUtilUser.createTester("Menu", { root: trigger });
    await menu.open();
    expect(menu.getOptions()).toHaveLength(2);
    await menu.close();
  });

  it("supports Select inside Tabs", async () => {
    const tree = renderIt(() => (
      <Tabs>
        <div>
          <TabList>
            <Tab id="key1">First Tab</Tab>
            <Tab id="key2">Second Tab</Tab>
          </TabList>
          <Select>
            <Label>Favorite Animal</Label>
            <Button>
              <SelectValue />
            </Button>
            <Popover>
              <ListBox>
                <ListBoxItem id="cat">Cat</ListBoxItem>
                <ListBoxItem id="dog">Dog</ListBoxItem>
                <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
              </ListBox>
            </Popover>
          </Select>
        </div>
        <TabPanel id="key1">First Tab content</TabPanel>
        <TabPanel id="key2">{() => "Second Tab content"}</TabPanel>
      </Tabs>
    ));

    const tester = testUtilUser.createTester("Tabs", { root: tree.getByRole("tablist") });
    expect(tester.getTabs().length).toBe(2);

    const trigger = tree.getByRole("button");
    const menu = testUtilUser.createTester("Select", { root: trigger });
    await menu.open();
    expect(menu.getOptions()).toHaveLength(3);
    await menu.close();
  });

  it("supports ComboBox inside Tabs", async () => {
    const tree = renderIt(() => (
      <Tabs>
        <div>
          <TabList>
            <Tab id="key1">First Tab</Tab>
            <Tab id="key2">Second Tab</Tab>
          </TabList>
          <ComboBox>
            <Label>Favorite Animal</Label>
            <Input />
            <Popover>
              <ListBox>
                <ListBoxItem id="cat">Cat</ListBoxItem>
                <ListBoxItem id="dog">Dog</ListBoxItem>
                <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
              </ListBox>
            </Popover>
          </ComboBox>
        </div>
        <TabPanel id="key1">First Tab content</TabPanel>
        <TabPanel id="key2">{() => "Second Tab content"}</TabPanel>
      </Tabs>
    ));

    const tester = testUtilUser.createTester("Tabs", { root: tree.getByRole("tablist") });
    expect(tester.getTabs().length).toBe(2);

    const menu = testUtilUser.createTester("ComboBox", {
      interactionType: "keyboard",
      root: document.querySelector<HTMLElement>(".rv-ComboBox")!,
    });
    await menu.open();
    expect(menu.getOptions()).toHaveLength(3);
    await menu.close();
  });

  it("supports DialogTrigger inside Tabs", async () => {
    const tree = renderIt(() => (
      <Tabs>
        <div>
          <TabList>
            <Tab id="key1">First Tab</Tab>
            <Tab id="key2">Second Tab</Tab>
          </TabList>
          <DialogTrigger>
            <Button>Dialog button</Button>
            <Popover aria-label="Filters">
              <Menu aria-label="Filter options">
                <MenuItem>Item 1</MenuItem>
                <MenuItem>Item 2</MenuItem>
              </Menu>
            </Popover>
          </DialogTrigger>
        </div>
        <TabPanel id="key1">First Tab content</TabPanel>
        <TabPanel id="key2">{() => "Second Tab content"}</TabPanel>
      </Tabs>
    ));

    const tester = testUtilUser.createTester("Tabs", { root: tree.getByRole("tablist") });
    expect(tester.getTabs().length).toBe(2);

    const trigger = tree.getByRole("button");
    await user.click(trigger);

    const dialog = await waitFor(() => within(document.body).getByRole("dialog"));
    expect(within(dialog).getAllByRole("menuitem")).toHaveLength(2);
  });
});
