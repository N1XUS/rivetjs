// Ported from react-aria-components test/Menu.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within` on
// `document.body` (popovers portal out of the container); `className` → `class`; render props are accessors
// (`isHovered()`); `jest.fn` → `vi.fn`; real timers (`waitFor` instead of `jest.runAllTimers`); `useState` →
// signals; `<MenuContext.Provider value>` → runtime `Provider`; default classes `rv-*`; `data-rac` → none
// (Rivet renders no marker attribute: the case asserts the RAC data-* state attributes instead).
// Skipped: "should support custom render function" / "… as a link" (no RAC `render` prop); `portalContainer`
// (decision 12: no portalContainer); "Subdialog" (Dialog inside SubmenuTrigger: lane C1a dialog parts, follow-up);
// virtualized menus (VirtualizedMenu.test.tsx, no Virtualizer renderer for Menu yet); async loading
// `onLoadMore` intersection case (IntersectionObserver mock: covered by load-more-sentinel.browser.test.tsx).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, waitFor, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Header } from "../header/index.tsx";
import { Separator } from "../separator/index.tsx";
import { Text } from "../text/index.tsx";
import { Keyboard } from "../keyboard/index.tsx";
import { Autocomplete } from "../autocomplete/index.tsx";
import { SearchField } from "../search-field/index.tsx";
import { Input } from "../input/index.tsx";
import { Menu, MenuContext, MenuItem, MenuSection, MenuTrigger, SubmenuTrigger, type MenuItemProps, type MenuProps, type Selection } from "../menu/index.tsx";

afterEach(cleanup);

const screen = () => within(document.body);

function TestMenu(props: { menuProps?: Partial<MenuProps>; itemProps?: Partial<MenuItemProps>; hasSubmenu?: boolean; hasNestedSubmenu?: boolean }) {
  const menuProps = props.menuProps ?? {},
    itemProps = props.itemProps ?? {};
  return (
    <Menu aria-label="Test" {...menuProps}>
      <MenuItem {...itemProps} id="cat">
        Cat
      </MenuItem>
      <MenuItem {...itemProps} id="dog">
        Dog
      </MenuItem>
      <MenuItem {...itemProps} id="kangaroo">
        Kangaroo
      </MenuItem>
      {props.hasSubmenu ? (
        <SubmenuTrigger>
          <MenuItem {...itemProps} id="submenu-trigger">
            Submenu Trigger
          </MenuItem>
          <Popover>
            <Menu>
              <MenuItem {...itemProps} id="submenu-item-1">
                Submenu Item 1
              </MenuItem>
              <MenuItem {...itemProps} id="submenu-item-2">
                Submenu Item 2
              </MenuItem>
              <MenuItem {...itemProps} id="submenu-item-3">
                Submenu Item 3
              </MenuItem>
              {props.hasNestedSubmenu ? (
                <SubmenuTrigger>
                  <MenuItem {...itemProps} id="nested-submenu-trigger">
                    Nested Submenu Trigger
                  </MenuItem>
                  <Popover>
                    <Menu>
                      <MenuItem {...itemProps} id="nested-submenu-item-1">
                        Nested Submenu Item 1
                      </MenuItem>
                      <MenuItem {...itemProps} id="nested-submenu-item-2">
                        Nested Submenu Item 2
                      </MenuItem>
                      <MenuItem {...itemProps} id="nested-submenu-item-3">
                        Nested Submenu Item 3
                      </MenuItem>
                    </Menu>
                  </Popover>
                </SubmenuTrigger>
              ) : null}
            </Menu>
          </Popover>
        </SubmenuTrigger>
      ) : null}
    </Menu>
  );
}

const renderMenu = (menuProps: Partial<MenuProps> = {}, itemProps: Partial<MenuItemProps> = {}) => {
  render((() => <TestMenu menuProps={menuProps} itemProps={itemProps} />) as never);
  return screen();
};
const renderUI = (ui: () => unknown) => {
  render(ui as never);
  return screen();
};

function MenuTriggerExample(props: { trigger?: "press" | "longPress" | "contextMenu"; menuProps?: Partial<MenuProps>; onAction?: (key: unknown) => void }) {
  return (
    <MenuTrigger trigger={props.trigger}>
      <Button aria-label="Menu">Menu</Button>
      <Popover>
        <Menu onAction={props.onAction} {...(props.menuProps ?? {})}>
          <MenuItem id="open">Open</MenuItem>
          <MenuItem id="rename">Rename…</MenuItem>
          <MenuItem id="duplicate">Duplicate</MenuItem>
          <MenuItem id="share">Share…</MenuItem>
          <MenuItem id="delete">Delete…</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

describe("Menu", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should have the base set of aria and data attributes", () => {
    const { getByRole, getAllByRole } = renderUI(() => (
      <Menu aria-label="Animals">
        <MenuItem id="cat">Cat</MenuItem>
        <MenuItem id="dog">Dog</MenuItem>
        <MenuItem id="kangaroo">Kangaroo</MenuItem>
        <MenuSection>
          <Header>Fish</Header>
          <MenuItem id="salmon">Salmon</MenuItem>
          <MenuItem id="tuna">Tuna</MenuItem>
          <MenuItem id="cod">Cod</MenuItem>
        </MenuSection>
      </Menu>
    ));
    const menu = getByRole("menu");
    expect(menu).toHaveAttribute("aria-label", "Animals");
    expect(getAllByRole("group")).toHaveLength(1);
    expect(getAllByRole("menuitem")).toHaveLength(6);
    for (const menuitem of getAllByRole("menuitem")) expect(menuitem).toHaveAttribute("data-key");
  });

  it("should render with default classes", () => {
    const { getByRole, getAllByRole } = renderMenu();
    expect(getByRole("menu")).toHaveAttribute("class", "rv-Menu");
    for (const menuitem of getAllByRole("menuitem")) expect(menuitem).toHaveAttribute("class", "rv-MenuItem");
  });

  it("should render with custom classes", () => {
    const { getByRole, getAllByRole } = renderMenu({ class: "menu" }, { class: "item" });
    expect(getByRole("menu")).toHaveAttribute("class", "menu");
    for (const menuitem of getAllByRole("menuitem")) expect(menuitem).toHaveAttribute("class", "item");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderMenu({ "data-foo": "bar" } as never, { "data-bar": "foo" } as never);
    expect(getByRole("menu")).toHaveAttribute("data-foo", "bar");
    for (const menuitem of getAllByRole("menuitem")) expect(menuitem).toHaveAttribute("data-bar", "foo");
  });

  it("should support the slot prop", () => {
    const { getByRole } = renderUI(() => (
      <Provider token={MenuContext} value={{ slots: { test: { "aria-label": "test" } } }}>
        <TestMenu menuProps={{ slot: "test", "aria-label": undefined }} />
      </Provider>
    ));
    const menu = getByRole("menu");
    expect(menu).toHaveAttribute("slot", "test");
    expect(menu).toHaveAttribute("aria-label", "test");
  });

  it("should support refs", async () => {
    const menuRef = { current: null as HTMLElement | null };
    const sectionRef = { current: null as HTMLElement | null };
    const itemRef = { current: null as HTMLElement | null };
    renderUI(() => (
      <Menu aria-label="Test" ref={menuRef as never}>
        <MenuSection ref={sectionRef as never} aria-label="Felines">
          <MenuItem ref={itemRef as never}>Cat</MenuItem>
        </MenuSection>
      </Menu>
    ));
    await flush();
    expect(menuRef.current).toBeInstanceOf(HTMLElement);
    expect(sectionRef.current).toBeInstanceOf(HTMLElement);
    expect(itemRef.current).toBeInstanceOf(HTMLElement);
    expect(sectionRef.current).toHaveAttribute("aria-label", "Felines");
  });

  it("should support hover", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderMenu({}, {
      class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
      onHoverStart,
      onHoverChange,
      onHoverEnd,
    } as never);
    const item = getAllByRole("menuitem")[0]!;
    expect(item).not.toHaveAttribute("data-hovered");
    expect(item).not.toHaveClass("hover");

    await user.hover(item);
    expect(item).toHaveAttribute("data-hovered", "true");
    expect(item).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(1);

    await user.unhover(item);
    expect(item).not.toHaveAttribute("data-hovered");
    expect(item).not.toHaveClass("hover");
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
  });

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderMenu({ disabledKeys: ["cat", "dog", "kangaroo"] }, {
      class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
      onHoverStart,
      onHoverChange,
      onHoverEnd,
    } as never);
    const item = getAllByRole("menuitem")[0]!;
    await user.hover(item);
    expect(item).not.toHaveAttribute("data-hovered");
    expect(item).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it("should support slots", () => {
    const { getByRole } = renderUI(() => (
      <Menu aria-label="Actions">
        <MenuItem textValue="Copy">
          <Text slot="label">Copy</Text>
          <Text slot="description">Copy the selected text</Text>
          <Keyboard>⌘C</Keyboard>
        </MenuItem>
      </Menu>
    ));
    const menuitem = getByRole("menuitem");
    expect(menuitem).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(menuitem.getAttribute("aria-labelledby")!)).toHaveTextContent("Copy");
    expect(menuitem).toHaveAttribute("aria-describedby");
    expect(
      menuitem
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((o) => document.getElementById(o)!.textContent)
        .join(" "),
    ).toBe("Copy the selected text ⌘C");
  });

  it("should support separators", () => {
    const { getByRole } = renderUI(() => (
      <Menu aria-label="Actions">
        <MenuItem>Foo</MenuItem>
        <Separator />
        <MenuItem>Bar</MenuItem>
      </Menu>
    ));
    expect(getByRole("separator")).toHaveClass("rv-Separator");
  });

  it("should support separators with custom class names", () => {
    const { getByRole } = renderUI(() => (
      <Menu aria-label="Actions">
        <MenuItem>Foo</MenuItem>
        <Separator class="my-separator" />
        <MenuItem>Bar</MenuItem>
      </Menu>
    ));
    expect(getByRole("separator")).toHaveClass("my-separator");
  });

  it("should support sections", () => {
    const { getAllByRole } = renderUI(() => (
      <Menu aria-label="Sandwich contents" selectionMode="multiple">
        <MenuSection>
          <Header>Veggies</Header>
          <MenuItem id="lettuce">Lettuce</MenuItem>
          <MenuItem id="tomato">Tomato</MenuItem>
          <MenuItem id="onion">Onion</MenuItem>
        </MenuSection>
        <MenuSection>
          <Header>Protein</Header>
          <MenuItem id="ham">Ham</MenuItem>
          <MenuItem id="tuna">Tuna</MenuItem>
          <MenuItem id="tofu">Tofu</MenuItem>
        </MenuSection>
      </Menu>
    ));
    const groups = getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveClass("rv-MenuSection");
    expect(groups[1]).toHaveClass("rv-MenuSection");
    expect(groups[0]).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(groups[0]!.getAttribute("aria-labelledby")!)).toHaveTextContent("Veggies");
  });

  it("should support dynamic collections", () => {
    const items = [
      { id: "cat", name: "Cat" },
      { id: "dog", name: "Dog" },
    ];
    const { getAllByRole } = renderUI(() => (
      <Menu aria-label="Test" items={items}>
        {(item: { id: string; name: string }) => <MenuItem id={item.id}>{item.name}</MenuItem>}
      </Menu>
    ));
    expect(getAllByRole("menuitem").map((it) => it.textContent)).toEqual(["Cat", "Dog"]);
  });

  it("should support focus ring", async () => {
    const { getAllByRole } = renderMenu({}, { class: ({ isFocusVisible }: { isFocusVisible: () => boolean }) => (isFocusVisible() ? "focus" : "") } as never);
    const menuitem = getAllByRole("menuitem")[0]!;
    expect(menuitem).not.toHaveAttribute("data-focus-visible");
    expect(menuitem).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(menuitem);
    expect(menuitem).toHaveAttribute("data-focus-visible", "true");
    expect(menuitem).toHaveClass("focus");

    fireEvent.keyDown(menuitem, { key: "ArrowDown" });
    fireEvent.keyUp(menuitem, { key: "ArrowDown" });
    expect(menuitem).not.toHaveAttribute("data-focus-visible");
    expect(menuitem).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderMenu({}, { class: ({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "") } as never);
    const menuitem = getAllByRole("menuitem")[0]!;
    expect(menuitem).not.toHaveAttribute("data-pressed");
    await user.pointer({ target: menuitem, keys: "[MouseLeft>]" });
    expect(menuitem).toHaveAttribute("data-pressed", "true");
    expect(menuitem).toHaveClass("pressed");
    await user.pointer({ target: menuitem, keys: "[/MouseLeft]" });
    expect(menuitem).not.toHaveAttribute("data-pressed");
    expect(menuitem).not.toHaveClass("pressed");
  });

  it("should support selection state", async () => {
    const { getAllByRole } = renderMenu({ selectionMode: "multiple" }, {
      class: ({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "selected" : ""),
    } as never);
    const menuitem = getAllByRole("menuitemcheckbox")[0]!;
    expect(menuitem).not.toHaveAttribute("aria-checked", "true");
    expect(menuitem).not.toHaveClass("selected");
    await user.click(menuitem);
    expect(menuitem).toHaveAttribute("aria-checked", "true");
    expect(menuitem).toHaveClass("selected");
    await user.click(menuitem);
    expect(menuitem).not.toHaveAttribute("aria-checked", "true");
    expect(menuitem).not.toHaveClass("selected");
  });

  it("should support section-level selection", async () => {
    const onFocus = vi.fn();
    const onFocusChange = vi.fn();
    const onBlur = vi.fn();
    function Example() {
      const veggies = signal<Selection>(new Set(["lettuce"]));
      const protein = signal<Selection>(new Set(["ham"]));
      return (
        <Menu aria-label="Sandwich contents" selectionMode="multiple">
          <MenuSection selectionMode="multiple" selectedKeys={veggies}>
            <MenuItem onFocus={onFocus} onFocusChange={onFocusChange} onBlur={onBlur} id="lettuce">
              Lettuce
            </MenuItem>
            <MenuItem id="tomato">Tomato</MenuItem>
            <MenuItem id="onion">Onion</MenuItem>
          </MenuSection>
          <MenuSection selectionMode="single" selectedKeys={protein}>
            <MenuItem id="ham">Ham</MenuItem>
            <MenuItem id="tuna">Tuna</MenuItem>
            <MenuItem id="tofu">Tofu</MenuItem>
          </MenuSection>
        </Menu>
      );
    }
    const { getAllByRole } = renderUI(() => <Example />);
    const checkboxes = getAllByRole("menuitemcheckbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "true");
    expect(checkboxes[1]).toHaveAttribute("aria-checked", "false");
    expect(checkboxes[2]).toHaveAttribute("aria-checked", "false");
    await user.click(checkboxes[1]!);
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "true");
    expect(checkboxes[1]).toHaveAttribute("aria-checked", "true");
    expect(checkboxes[2]).toHaveAttribute("aria-checked", "false");

    const radios = getAllByRole("menuitemradio");
    expect(radios).toHaveLength(3);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    await user.click(radios[1]!);
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[2]).toHaveAttribute("aria-checked", "false");

    onFocus.mockClear();
    onFocusChange.mockClear();
    onBlur.mockClear();
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(checkboxes[0]);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(0);
    onFocus.mockClear();
    onFocusChange.mockClear();
    onBlur.mockClear();
    for (const item of checkboxes.slice(1).concat(radios)) {
      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(item);
    }
    expect(onFocus).toHaveBeenCalledTimes(0);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('should prevent Esc from clearing selection if escapeKeyBehavior is "none"', async () => {
    const { getAllByRole } = renderMenu({ selectionMode: "multiple", escapeKeyBehavior: "none" });
    const menuitem = getAllByRole("menuitemcheckbox")[0]!;
    await user.click(menuitem);
    expect(menuitem).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Escape}");
    expect(menuitem).toHaveAttribute("aria-checked", "true");
  });

  it("should support disabled state", () => {
    const { getAllByRole } = renderMenu({ disabledKeys: ["cat"] }, {
      class: ({ isDisabled }: { isDisabled: () => boolean }) => (isDisabled() ? "disabled" : ""),
    } as never);
    const menuitem = getAllByRole("menuitem")[0]!;
    expect(menuitem).toHaveAttribute("aria-disabled", "true");
    expect(menuitem).toHaveClass("disabled");
  });

  it("should support isDisabled prop on items", async () => {
    const { getAllByRole } = renderUI(() => (
      <Menu aria-label="Test">
        <MenuItem id="cat">Cat</MenuItem>
        <MenuItem id="dog" isDisabled>
          Dog
        </MenuItem>
        <MenuItem id="kangaroo">Kangaroo</MenuItem>
      </Menu>
    ));
    const items = getAllByRole("menuitem");
    expect(items[1]).toHaveAttribute("aria-disabled", "true");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);
  });

  it("should support onAction on items", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderUI(() => (
      <Menu aria-label="Test">
        <MenuItem id="cat" onAction={onAction}>
          Cat
        </MenuItem>
        <MenuItem id="dog">Dog</MenuItem>
      </Menu>
    ));
    await user.click(getAllByRole("menuitem")[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should support onAction on menu and menu items", async () => {
    const onAction = vi.fn();
    const itemAction = vi.fn();
    const { getAllByRole } = renderUI(() => (
      <Menu aria-label="Test" onAction={onAction}>
        <MenuItem id="cat" onAction={itemAction}>
          Cat
        </MenuItem>
        <MenuItem id="dog">Dog</MenuItem>
      </Menu>
    ));
    await user.click(getAllByRole("menuitem")[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(itemAction).toHaveBeenCalledTimes(1);
  });

  it("should support menu trigger", async () => {
    const onAction = vi.fn();
    const { getByRole, getAllByRole } = renderUI(() => <MenuTriggerExample onAction={onAction} />);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("data-pressed");
    await user.click(button);
    expect(button).toHaveAttribute("data-pressed");
    const menu = getByRole("menu");
    expect(getAllByRole("menuitem")).toHaveLength(5);
    const popover = menu.closest(".rv-Popover");
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveAttribute("data-trigger", "MenuTrigger");
    await user.click(getAllByRole("menuitem")[1]!);
    expect(onAction).toHaveBeenLastCalledWith("rename");
  });

  it("should support a context menu trigger", async () => {
    const onAction = vi.fn();
    const { getByRole, getAllByRole, queryByRole } = renderUI(() => <MenuTriggerExample trigger="contextMenu" onAction={onAction} />);
    const button = getByRole("button");
    expect(button).not.toHaveAttribute("aria-haspopup");
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(button).not.toHaveAttribute("aria-controls");
    expect(queryByRole("menu")).not.toBeInTheDocument();
    // A regular press should not open a context menu trigger.
    await user.click(button);
    expect(queryByRole("menu")).not.toBeInTheDocument();
    // Right click opens the menu at the pointer position.
    await user.pointer({ target: button, keys: "[MouseRight]", coords: { clientX: 10, clientY: 20 } });
    const menu = await waitFor(() => getByRole("menu"));
    expect(getAllByRole("menuitem")).toHaveLength(5);
    expect(button).not.toHaveAttribute("aria-expanded");
    expect(menu.closest(".rv-Popover")).toHaveAttribute("data-trigger", "MenuTrigger");
    await user.click(getAllByRole("menuitem")[1]!);
    expect(onAction).toHaveBeenLastCalledWith("rename");
    await waitFor(() => expect(queryByRole("menu")).not.toBeInTheDocument());
  });

  it("should close a context menu when right clicking outside", async () => {
    const { getByRole, queryByRole } = renderUI(() => <MenuTriggerExample trigger="contextMenu" />);
    const button = getByRole("button");
    await user.pointer({ target: button, keys: "[MouseRight]" });
    await waitFor(() => expect(getByRole("menu")).toBeInTheDocument());
    // Right clicking inside the menu should not close it.
    await user.pointer({ target: getByRole("menu"), keys: "[MouseRight]" });
    expect(getByRole("menu")).toBeInTheDocument();
    // Right clicking outside (on the body) closes the menu so the browser's context menu can appear.
    await user.pointer({ target: document.body, keys: "[MouseRight]" });
    await waitFor(() => expect(queryByRole("menu")).not.toBeInTheDocument());
  });

  it("should support onScroll", () => {
    const onScroll = vi.fn();
    const { getByRole } = renderMenu({ onScroll } as never);
    fireEvent.scroll(getByRole("menu"));
    expect(onScroll).toHaveBeenCalled();
  });

  it("should support empty state", () => {
    const { getByRole } = renderUI(() => (
      <Menu aria-label="Test" renderEmptyState={() => "No results"}>
        {[]}
      </Menu>
    ));
    expect(getByRole("menu")).toHaveAttribute("data-empty", "true");
    expect(getByRole("menuitem")).toHaveTextContent("No results");
  });

  it("should not close the menu when shouldCloseOnSelect is false", async () => {
    const { queryByRole, getByRole, getAllByRole } = renderUI(() => <MenuTriggerExample menuProps={{ shouldCloseOnSelect: false }} />);
    expect(queryByRole("menu")).not.toBeInTheDocument();
    await user.click(getByRole("button"));
    const menu = getByRole("menu");
    const items = getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    await user.click(items[0]!);
    expect(menu).toBeInTheDocument();
  });

  it("should not close individual menu item when shouldCloseOnSelect=false", async () => {
    const { getByRole, getAllByRole } = renderUI(() => (
      <MenuTrigger>
        <Button aria-label="Menu">Menu</Button>
        <Popover>
          <Menu>
            <MenuItem id="open" shouldCloseOnSelect={false}>
              Open
            </MenuItem>
            <MenuItem id="rename">Rename…</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    ));
    await user.click(getByRole("button"));
    const menu = getByRole("menu");
    const items = getAllByRole("menuitem");
    await user.click(items[0]!);
    expect(menu).toBeInTheDocument();
    await user.click(items[1]!);
    await waitFor(() => expect(menu).not.toBeInTheDocument());
  });

  it("should not close menu items within a section when shouldCloseOnSelect=false", async () => {
    const { getByRole, getAllByRole } = renderUI(() => (
      <MenuTrigger>
        <Button aria-label="Menu">Menu</Button>
        <Popover>
          <Menu>
            <MenuSection shouldCloseOnSelect={false}>
              <MenuItem id="open">Open</MenuItem>
              <MenuItem id="rename">Rename…</MenuItem>
              <MenuItem id="duplicate">Duplicate</MenuItem>
            </MenuSection>
            <MenuSection>
              <MenuItem id="share">Share…</MenuItem>
              <MenuItem id="delete">Delete…</MenuItem>
            </MenuSection>
          </Menu>
        </Popover>
      </MenuTrigger>
    ));
    await user.click(getByRole("button"));
    const menu = getByRole("menu");
    const items = getAllByRole("menuitem");
    expect(items).toHaveLength(5);
    await user.click(items[0]!);
    expect(menu).toBeInTheDocument();
    await user.click(items[3]!);
    await waitFor(() => expect(menu).not.toBeInTheDocument());
  });

  describe("supports links", () => {
    describe.each(["mouse", "keyboard"])("%s", (type) => {
      it.each(["none", "single", "multiple"] as const)("with selectionMode = %s", async (selectionMode) => {
        const onAction = vi.fn();
        const onSelectionChange = vi.fn();
        const { getAllByRole } = renderUI(() => (
          <Menu aria-label="menu" selectionMode={selectionMode} onSelectionChange={onSelectionChange} onAction={onAction}>
            <MenuItem href="https://google.com">One</MenuItem>
            <MenuItem href="https://adobe.com">Two</MenuItem>
          </Menu>
        ));
        const role = { none: "menuitem", single: "menuitemradio", multiple: "menuitemcheckbox" }[selectionMode];
        const items = getAllByRole(role);
        expect(items).toHaveLength(2);
        expect(items[0]!.tagName).toBe("A");
        expect(items[0]).toHaveAttribute("href", "https://google.com");
        expect(items[1]!.tagName).toBe("A");
        expect(items[1]).toHaveAttribute("href", "https://adobe.com");
        // mockClickDefault: a capture listener that records + prevents the navigation.
        const onClick = vi.fn((e: Event) => e.preventDefault());
        document.addEventListener("click", onClick, { capture: true });
        if (type === "mouse") await user.click(items[1]!);
        else {
          fireEvent.keyDown(items[1]!, { key: "Enter" });
          fireEvent.click(items[1]!);
          fireEvent.keyUp(items[1]!, { key: "Enter" });
        }
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
        document.removeEventListener("click", onClick, { capture: true });
      });
    });
  });
  describe("Submenus", () => {
    const ShareMenu = (props: { onAction?: (key: unknown) => void; nested?: boolean }) => (
      <MenuTrigger>
        <Button aria-label="Menu">Menu</Button>
        <Popover>
          <Menu onAction={props.onAction}>
            <MenuItem id="open">Open</MenuItem>
            <MenuItem id="rename">Rename…</MenuItem>
            <MenuItem id="duplicate">Duplicate</MenuItem>
            <SubmenuTrigger>
              <MenuItem id="share">Share…</MenuItem>
              <Popover>
                <Menu onAction={props.onAction}>
                  {props.nested ? (
                    <SubmenuTrigger>
                      <MenuItem id="email">Email…</MenuItem>
                      <Popover>
                        <Menu onAction={props.onAction}>
                          <MenuItem id="work">Work</MenuItem>
                          <MenuItem id="personal">Personal</MenuItem>
                        </Menu>
                      </Popover>
                    </SubmenuTrigger>
                  ) : (
                    <MenuItem id="email">Email</MenuItem>
                  )}
                  <MenuItem id="sms">SMS</MenuItem>
                  <MenuItem id="x">X</MenuItem>
                </Menu>
              </Popover>
            </SubmenuTrigger>
            <MenuItem id="delete">Delete…</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    );

    async function openShare(s: ReturnType<typeof screen>) {
      const button = s.getByRole("button");
      await user.click(button);
      expect(button).toHaveAttribute("data-pressed");
      const menu = s.getAllByRole("menu")[0]!;
      expect(s.getAllByRole("menuitem")).toHaveLength(5);
      expect(menu.closest(".rv-Popover")).toHaveAttribute("data-trigger", "MenuTrigger");
      const triggerItem = s.getAllByRole("menuitem")[3]!;
      expect(triggerItem).toHaveTextContent("Share…");
      expect(triggerItem).toHaveAttribute("aria-haspopup", "menu");
      expect(triggerItem).toHaveAttribute("aria-expanded", "false");
      expect(triggerItem).toHaveAttribute("data-has-submenu", "true");
      expect(triggerItem).not.toHaveAttribute("data-open");
      // Open the submenu (hover, 200ms delay).
      await user.pointer({ target: triggerItem });
      await waitFor(() => expect(triggerItem).toHaveAttribute("aria-expanded", "true"));
      expect(triggerItem).toHaveAttribute("data-hovered", "true");
      expect(triggerItem).toHaveAttribute("data-open", "true");
      const submenu = s.getAllByRole("menu")[1]!;
      expect(submenu.closest(".rv-Popover")).toHaveAttribute("data-trigger", "SubmenuTrigger");
      return { menu, triggerItem, submenu };
    }

    it("should support a submenu trigger", async () => {
      const onAction = vi.fn();
      const s = renderUI(() => <ShareMenu onAction={onAction} />);
      const { menu, submenu } = await openShare(s);
      // Click a submenu item
      await user.click(s.getAllByRole("menuitem")[5]!);
      expect(onAction).toHaveBeenLastCalledWith("email");
      await waitFor(() => expect(menu).not.toBeInTheDocument());
      expect(submenu).not.toBeInTheDocument();
    });

    it("should support nested submenu triggers", async () => {
      const onAction = vi.fn();
      const s = renderUI(() => <ShareMenu onAction={onAction} nested />);
      const { submenu } = await openShare(s);
      const nestedTriggerItem = s.getAllByRole("menuitem")[5]!;
      expect(nestedTriggerItem).toHaveTextContent("Email…");
      expect(nestedTriggerItem).toHaveAttribute("aria-haspopup", "menu");
      expect(nestedTriggerItem).toHaveAttribute("aria-expanded", "false");
      await user.pointer({ target: nestedTriggerItem });
      await waitFor(() => expect(nestedTriggerItem).toHaveAttribute("aria-expanded", "true"));
      expect(nestedTriggerItem).toHaveAttribute("data-open", "true");
      const nestedSubmenu = s.getAllByRole("menu")[2]!;
      expect(nestedSubmenu.closest(".rv-Popover")).toHaveAttribute("data-trigger", "SubmenuTrigger");
      // Click a nested submenu item
      await user.click(s.getAllByRole("menuitem")[8]!);
      expect(onAction).toHaveBeenLastCalledWith("work");
      await waitFor(() => expect(nestedSubmenu).not.toBeInTheDocument());
      expect(submenu).not.toBeInTheDocument();
    });

    it("should close all submenus if interacting outside root submenu", async () => {
      const s = renderUI(() => <ShareMenu nested />);
      const { menu, submenu } = await openShare(s);
      const nestedTriggerItem = s.getAllByRole("menuitem")[5]!;
      await user.pointer({ target: nestedTriggerItem });
      await waitFor(() => expect(nestedTriggerItem).toHaveAttribute("aria-expanded", "true"));
      const nestedSubmenu = s.getAllByRole("menu")[2]!;
      const underlay = s.getByTestId("underlay");
      expect(underlay).toBeInTheDocument();
      await user.click(document.body);
      await waitFor(() => expect(menu).not.toBeInTheDocument());
      expect(nestedSubmenu).not.toBeInTheDocument();
      expect(submenu).not.toBeInTheDocument();
      expect(underlay).not.toBeInTheDocument();
    });

    it("should restore focus to menu trigger if submenu is closed with Escape key", async () => {
      const s = renderUI(() => <ShareMenu />);
      const { menu, triggerItem, submenu } = await openShare(s);
      const submenuItems = within(submenu).getAllByRole("menuitem");
      expect(submenuItems).toHaveLength(3);
      await user.pointer({ target: submenuItems[0]! });
      await waitFor(() => expect(document.activeElement).toBe(submenuItems[0]));
      await user.keyboard("{Escape}");
      await waitFor(() => expect(submenu).not.toBeInTheDocument());
      expect(menu).toBeInTheDocument();
      await waitFor(() => expect(document.activeElement).toBe(triggerItem));
    });

    it("should open a submenu with the keyboard and close it with ArrowLeft", async () => {
      const s = renderUI(() => <ShareMenu />);
      await user.click(s.getByRole("button"));
      const menu = s.getAllByRole("menu")[0]!;
      const triggerItem = s.getAllByRole("menuitem")[3]!;
      triggerItem.focus();
      await user.keyboard("{ArrowRight}");
      await waitFor(() => expect(s.getAllByRole("menu")).toHaveLength(2));
      const submenu = s.getAllByRole("menu")[1]!;
      await waitFor(() => expect(document.activeElement).toBe(within(submenu).getAllByRole("menuitem")[0]));
      await user.keyboard("{ArrowLeft}");
      await waitFor(() => expect(submenu).not.toBeInTheDocument());
      // The submenu's FocusScope restores focus to its trigger item (RAC test runs the timers).
      await waitFor(() => expect(document.activeElement).toBe(triggerItem));
      expect(menu).toBeInTheDocument();
      expect(document.activeElement).toBe(triggerItem);
    });
  });

  // Rivet: SelectableCollectionContext wiring (RAC Autocomplete.test.tsx covers it through its Menu cases).
  describe("inside Autocomplete", () => {
    function AutocompleteMenu(props: { onAction?: (key: unknown) => void }) {
      const onAction = props.onAction;
      return (
        <Autocomplete filter={(text: string, input: string) => text.toLowerCase().includes(input.toLowerCase())}>
          <SearchField aria-label="Search">
            <Input />
          </SearchField>
          <Menu aria-label="Commands" onAction={(key: unknown) => onAction?.(key)}>
            <MenuItem id="foo">Foo</MenuItem>
            <MenuItem id="bar">Bar</MenuItem>
            <MenuItem id="baz">Baz</MenuItem>
          </Menu>
        </Autocomplete>
      );
    }

    it("uses virtual focus: no tabindex on the menu or its items", async () => {
      const s = renderUI(() => <AutocompleteMenu />);
      await flush();
      const menu = s.getByRole("menu");
      expect(menu).not.toHaveAttribute("tabindex");
      for (const item of within(menu).getAllByRole("menuitem")) expect(item).not.toHaveAttribute("tabindex");
    });

    it("filters items as the user types", async () => {
      const s = renderUI(() => <AutocompleteMenu />);
      const input = s.getByRole("searchbox");
      await user.click(input);
      await user.keyboard("ba");
      await waitFor(() =>
        expect(
          within(s.getByRole("menu"))
            .getAllByRole("menuitem")
            .map((i) => i.textContent),
        ).toEqual(["Bar", "Baz"]),
      );
      expect(document.activeElement).toBe(input);
    });

    it("moves virtual focus with the arrow keys and triggers onAction on Enter", async () => {
      const onAction = vi.fn();
      const actions: Event[] = [];
      const s = renderUI(() => <AutocompleteMenu onAction={onAction} />);
      const menu = s.getByRole("menu");
      menu.addEventListener("react-aria-item-action", (e) => actions.push(e));
      const input = s.getByRole("searchbox");
      await user.click(input);
      await user.keyboard("{ArrowDown}");
      const items = within(menu).getAllByRole("menuitem");
      await waitFor(() => expect(input).toHaveAttribute("aria-activedescendant", items[0]!.id));
      expect(document.activeElement).toBe(input);
      await user.keyboard("{ArrowDown}");
      await waitFor(() => expect(input).toHaveAttribute("aria-activedescendant", items[1]!.id));
      expect(items[1]).toHaveAttribute("data-focused", "true");
      await user.keyboard("{Enter}");
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenLastCalledWith("bar");
      expect(actions).toHaveLength(1);
    });

    it("focuses the first matching item after typing forward", async () => {
      const s = renderUI(() => <AutocompleteMenu />);
      const input = s.getByRole("searchbox");
      await user.click(input);
      await user.keyboard("ba");
      await waitFor(() => {
        const first = within(s.getByRole("menu")).getAllByRole("menuitem")[0]!;
        expect(input).toHaveAttribute("aria-activedescendant", first.id);
      });
    });
  });
});
