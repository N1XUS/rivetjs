// Ported from react-aria-components test/ListBox.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries from `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isHovered()`); `jest.fn` → `vi.fn`; `userEvent.setup()` (real
// PointerEvent, real timers); `React.createRef` → `ref()`; `rerender` → signals; testers from `@rivetjs/testing/user`;
// default classes `rv-*`; `data-rac` marker → default classes.
// Skipped: "custom render function" (+ "as a link": no `render` prop); every drag and drop case ("draggable options",
// "drag and drop" describe: C8); "virtualizer" / "async loading > virtualized" (Virtualizer lane); "Activity" cases
// (React-only); "inside modals" (Modal lane); "keyboard modifier keys" platform mocks (covered by
// selection/useSelectableCollection ports).
// Change: "long press" drives pointer events (the tester's TouchEvent init is rejected by Chromium).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { Show, ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Collection } from "../collections/components.tsx";
import { Header } from "../header/index.tsx";
import { Text } from "../text/index.tsx";
import { ListBox, ListBoxContext, ListBoxItem, ListBoxLoadMoreItem, ListBoxSection, type ListBoxItemProps, type ListBoxProps } from "../listbox/index.tsx";
import { Provider } from "../slots/index.tsx";
import { RouterProvider } from "../utils/links.tsx";

afterEach(cleanup);

const TestListBox = (p: { listBoxProps?: Partial<ListBoxProps>; itemProps?: Partial<ListBoxItemProps> }) => {
  const listBoxProps = p.listBoxProps ?? {};
  const itemProps = p.itemProps ?? {};
  return (
    <ListBox aria-label="Test" {...listBoxProps}>
      <ListBoxItem {...itemProps} id="cat">
        Cat
      </ListBoxItem>
      <ListBoxItem {...itemProps} id="dog">
        Dog
      </ListBoxItem>
      <ListBoxItem {...itemProps} id="kangaroo">
        Kangaroo
      </ListBoxItem>
    </ListBox>
  );
};

const renderListbox = (listBoxProps?: Partial<ListBoxProps>, itemProps?: Partial<ListBoxItemProps>) =>
  within(render(() => <TestListBox listBoxProps={listBoxProps} itemProps={itemProps} />).container as HTMLElement);
const renderIt = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);
const texts = (els: HTMLElement[]) => els.map((o) => o.textContent);

describe("ListBox", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) });
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should have the base set of aria and data attributes", () => {
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Animals">
        <ListBoxItem id="cat">Cat</ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
        <ListBoxSection>
          <Header>Fish</Header>
          <ListBoxItem id="salmon">Salmon</ListBoxItem>
          <ListBoxItem id="tuna">Tuna</ListBoxItem>
          <ListBoxItem id="cod">Cod</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
    expect(tester.getListbox()).toHaveClass("rv-ListBox");
    for (const section of tester.getSections()) expect(section).toHaveClass("rv-ListBoxSection");
    for (const option of tester.getOptions()) expect(option).toHaveClass("rv-ListBoxItem");
  });

  it("should render with default classes", () => {
    const { getByRole, getAllByRole } = renderListbox();
    expect(getByRole("listbox")).toHaveAttribute("class", "rv-ListBox");
    for (const option of getAllByRole("option")) expect(option).toHaveAttribute("class", "rv-ListBoxItem");
  });

  it("should render with custom classes", () => {
    const { getByRole, getAllByRole } = renderListbox({ class: "listbox" }, { class: "item" });
    expect(getByRole("listbox")).toHaveAttribute("class", "listbox");
    for (const option of getAllByRole("option")) expect(option).toHaveAttribute("class", "item");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderListbox({ "data-foo": "bar" } as never, { "data-bar": "foo" } as never);
    expect(getByRole("listbox")).toHaveAttribute("data-foo", "bar");
    for (const option of getAllByRole("option")) expect(option).toHaveAttribute("data-bar", "foo");
  });

  it("should support aria-label on the listbox items", () => {
    const { getAllByRole } = renderListbox({}, { "aria-label": "test" });
    for (const option of getAllByRole("option")) expect(option).toHaveAttribute("aria-label", "test");
  });

  it("should support the slot prop", () => {
    const { getByRole } = renderIt(() => (
      <Provider values={[[ListBoxContext, { slots: { test: { "aria-label": "test" } } }]]}>
        <TestListBox listBoxProps={{ slot: "test", "aria-label": undefined }} />
      </Provider>
    ));
    const listbox = getByRole("listbox");
    expect(listbox).toHaveAttribute("slot", "test");
    expect(listbox).toHaveAttribute("aria-label", "test");
  });

  it("should support refs", async () => {
    const listBoxRef = ref<HTMLDivElement>();
    const sectionRef = ref<HTMLElement>();
    const itemRef = ref<HTMLElement>();
    renderIt(() => (
      <ListBox aria-label="Test" ref={listBoxRef}>
        <ListBoxSection ref={sectionRef}>
          <ListBoxItem ref={itemRef}>Cat</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    await flush();
    expect(listBoxRef()).toBeInstanceOf(HTMLElement);
    expect(sectionRef()).toBeInstanceOf(HTMLElement);
    expect(itemRef()).toBeInstanceOf(HTMLElement);
  });

  it("should support slots", () => {
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Sandwich contents" selectionMode="multiple">
        <ListBoxItem textValue="Read">
          <Text slot="label">Read</Text>
          <Text slot="description">Read only</Text>
        </ListBoxItem>
      </ListBox>
    ));
    const option = getByRole("option");
    expect(option).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(option.getAttribute("aria-labelledby")!)).toHaveTextContent("Read");
    expect(option).toHaveAttribute("aria-describedby");
    expect(document.getElementById(option.getAttribute("aria-describedby")!)).toHaveTextContent("Read only");
  });

  it("should support sections", () => {
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Sandwich contents" selectionMode="multiple">
        <ListBoxSection data-test-prop="test-section-1">
          <Header>Veggies</Header>
          <ListBoxItem id="lettuce">Lettuce</ListBoxItem>
          <ListBoxItem id="tomato">Tomato</ListBoxItem>
          <ListBoxItem id="onion">Onion</ListBoxItem>
        </ListBoxSection>
        <ListBoxSection data-test-prop="test-section-2" aria-label="Protein">
          <ListBoxItem id="ham">Ham</ListBoxItem>
          <ListBoxItem id="tuna">Tuna</ListBoxItem>
          <ListBoxItem id="tofu">Tofu</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    const groups = getAllByRole("group");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveClass("rv-ListBoxSection");
    expect(groups[1]).toHaveClass("rv-ListBoxSection");
    expect(groups[0]).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(groups[0]!.getAttribute("aria-labelledby")!)).toHaveTextContent("Veggies");
    expect(groups[1]!.getAttribute("aria-label")).toEqual("Protein");
    expect(groups[0]).toHaveAttribute("data-test-prop", "test-section-1");
    expect(groups[1]).toHaveAttribute("data-test-prop", "test-section-2");
  });

  it("should support dynamic collections", async () => {
    let options = [
      { id: 1, name: "Cat" },
      { id: 2, name: "Dog" },
    ];
    const items = signal(options);
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Animals" items={items}>
        {(item: { id: number; name: string }) => <ListBoxItem>{item.name}</ListBoxItem>}
      </ListBox>
    ));
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Dog"]);

    options = [options[0]!, options[1]!, { id: 3, name: "Mouse" }];
    items.set(options);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Dog", "Mouse"]);

    options = [options[0]!, { id: 4, name: "Kangaroo" }, options[1]!, options[2]!];
    items.set(options);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Kangaroo", "Dog", "Mouse"]);

    options = [options[0]!, options[1]!, { id: 2, name: "Doggy" }, options[3]!];
    items.set(options);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Kangaroo", "Doggy", "Mouse"]);

    options = [options[0]!, options[1]!, options[3]!, options[2]!];
    items.set(options);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Kangaroo", "Mouse", "Doggy"]);

    options = [options[0]!, options[1]!, options[2]!];
    items.set(options);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Cat", "Kangaroo", "Mouse"]);
  });

  it("should update collection when descendants update", async () => {
    const showTwo = signal(false);
    const itemText = signal("One");
    function Child() {
      return (
        <>
          <ListBoxItem id={1}>{itemText()}</ListBoxItem>
          <Show when={showTwo}>
            <ListBoxItem id={2}>Two</ListBoxItem>
          </Show>
        </>
      );
    }
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Example">
        <Child />
      </ListBox>
    ));
    expect(texts(getAllByRole("option"))).toEqual(["One"]);
    showTwo.set(true);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["One", "Two"]);
    showTwo.set(false);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["One"]);
    itemText.set("Hi");
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Hi"]);
  });

  it("should update collection when moving item to a different section", async () => {
    const moved = signal(false);
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Test">
        <ListBoxSection id="veggies">
          <Header>Veggies</Header>
          <ListBoxItem id="lettuce">Lettuce</ListBoxItem>
          <ListBoxItem id="tomato">Tomato</ListBoxItem>
          <ListBoxItem id="onion">Onion</ListBoxItem>
          <Show when={moved}>
            <ListBoxItem id="ham">Ham</ListBoxItem>
          </Show>
        </ListBoxSection>
        <ListBoxSection id="meats">
          <Header>Meats</Header>
          <Show when={() => !moved()}>
            <ListBoxItem id="ham">Ham</ListBoxItem>
          </Show>
          <ListBoxItem id="tuna">Tuna</ListBoxItem>
          <ListBoxItem id="tofu">Tofu</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    let sections = getAllByRole("group");
    expect(within(sections[0]!).getAllByRole("option")).toHaveLength(3);
    expect(within(sections[1]!).getAllByRole("option")).toHaveLength(3);
    moved.set(true);
    await flush();
    sections = getAllByRole("group");
    expect(within(sections[0]!).getAllByRole("option")).toHaveLength(4);
    expect(within(sections[1]!).getAllByRole("option")).toHaveLength(2);
  });

  it("should support dynamic collection with non-object entries", async () => {
    const items = signal(["Foo", "Bar", "Baz"]);
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Test" items={items}>
        {(item: string) => <ListBoxItem>{item}</ListBoxItem>}
      </ListBox>
    ));
    expect(texts(getAllByRole("option"))).toEqual(["Foo", "Bar", "Baz"]);
    items.set(["Foo", "Baz"]);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Foo", "Baz"]);
  });

  it("should update collection if render function changes", async () => {
    const objects = [{ name: "Foo" }, { name: "Bar" }, { name: "Baz" }];
    const updated = signal(false);
    const { getAllByRole } = renderIt(() => (
      <Show
        when={updated}
        fallback={
          <ListBox aria-label="Test" items={objects}>
            {(item: { name: string }) => <ListBoxItem id={item.name}>{item.name}</ListBoxItem>}
          </ListBox>
        }
      >
        <ListBox aria-label="Test" items={objects}>
          {(item: { name: string }) => (
            <ListBoxItem id={item.name} textValue="Updated">
              Updated: {item.name}
            </ListBoxItem>
          )}
        </ListBox>
      </Show>
    ));
    expect(texts(getAllByRole("option"))).toEqual(["Foo", "Bar", "Baz"]);
    updated.set(true);
    await flush();
    expect(texts(getAllByRole("option"))).toEqual(["Updated: Foo", "Updated: Bar", "Updated: Baz"]);
  });

  it("should support autoFocus", async () => {
    const { getByRole } = renderListbox({ autoFocus: true });
    await flush();
    expect(document.activeElement).toBe(getByRole("listbox"));
  });

  it("should support hover", async () => {
    const hoverStartSpy = vi.fn();
    const hoverChangeSpy = vi.fn();
    const hoverEndSpy = vi.fn();
    const { getAllByRole } = renderListbox(
      { selectionMode: "multiple" },
      { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart: hoverStartSpy, onHoverEnd: hoverEndSpy, onHoverChange: hoverChangeSpy },
    );
    const option = getAllByRole("option")[0]!;
    expect(option).not.toHaveAttribute("data-hovered");
    expect(option).not.toHaveClass("hover");
    await user.hover(option);
    expect(option).toHaveAttribute("data-hovered", "true");
    expect(option).toHaveClass("hover");
    expect(hoverStartSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(1);
    await user.unhover(option);
    expect(option).not.toHaveAttribute("data-hovered");
    expect(option).not.toHaveClass("hover");
    expect(hoverEndSpy).toHaveBeenCalledTimes(1);
    expect(hoverChangeSpy).toHaveBeenCalledTimes(2);
  });

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderListbox({}, { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart, onHoverEnd, onHoverChange });
    const option = getAllByRole("option")[0]!;
    await user.hover(option);
    expect(option).not.toHaveAttribute("data-hovered");
    expect(option).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it("should support focus ring", async () => {
    const { getAllByRole } = renderListbox(
      { selectionMode: "multiple", shouldFocusOnHover: true },
      { class: ({ isFocusVisible }) => (isFocusVisible() ? "focus" : "") },
    );
    const option = getAllByRole("option")[0]!;
    expect(option).not.toHaveAttribute("data-focus-visible");
    expect(option).not.toHaveClass("focus");
    await user.tab();
    expect(document.activeElement).toBe(option);
    expect(option).toHaveAttribute("data-focus-visible", "true");
    expect(option).toHaveClass("focus");
    expect(option).not.toHaveAttribute("data-hovered");
    fireEvent.keyDown(option, { key: "ArrowDown" });
    fireEvent.keyUp(option, { key: "ArrowDown" });
    await flush();
    expect(option).not.toHaveAttribute("data-focus-visible");
    expect(option).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderListbox({ selectionMode: "multiple" }, { class: ({ isPressed }) => (isPressed() ? "pressed" : "") });
    const option = getAllByRole("option")[0]!;
    expect(option).not.toHaveAttribute("data-pressed");
    await user.pointer({ target: option, keys: "[MouseLeft>]" });
    expect(option).toHaveAttribute("data-pressed", "true");
    expect(option).toHaveClass("pressed");
    await user.pointer({ target: option, keys: "[/MouseLeft]" });
    expect(option).not.toHaveAttribute("data-pressed");
    expect(option).not.toHaveClass("pressed");
  });

  it("should not show press state when not interactive", async () => {
    const { getAllByRole } = renderListbox({}, { class: ({ isPressed }) => (isPressed() ? "pressed" : "") });
    const option = getAllByRole("option")[0]!;
    await user.pointer({ target: option, keys: "[MouseLeft>]" });
    expect(option).not.toHaveAttribute("data-pressed");
    expect(option).not.toHaveClass("pressed");
    await user.pointer({ target: option, keys: "[/MouseLeft]" });
    expect(option).not.toHaveAttribute("data-pressed");
  });

  it("should support selection state", async () => {
    const { getByRole } = renderListbox({ selectionMode: "multiple" }, { class: ({ isSelected }) => (isSelected() ? "selected" : "") });
    const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
    const option = tester.getOptions()[0]!;
    expect(option).not.toHaveAttribute("aria-selected", "true");
    expect(option).not.toHaveClass("selected");
    await tester.toggleOptionSelection({ option });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option).toHaveClass("selected");
    await tester.toggleOptionSelection({ option });
    expect(option).not.toHaveAttribute("aria-selected", "true");
    expect(option).not.toHaveClass("selected");
  });

  it("should support disabled state", () => {
    const { getAllByRole } = renderListbox(
      { selectionMode: "multiple", disabledKeys: ["cat"] },
      { class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") },
    );
    const option = getAllByRole("option")[0]!;
    expect(option).toHaveAttribute("aria-disabled", "true");
    expect(option).toHaveClass("disabled");
  });

  it("should support isDisabled prop on items", async () => {
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Test">
        <ListBoxItem id="cat">Cat</ListBoxItem>
        <ListBoxItem id="dog" isDisabled>
          Dog
        </ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
      </ListBox>
    ));
    const items = getAllByRole("option");
    expect(items[1]).toHaveAttribute("aria-disabled", "true");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);
  });

  it.each(["mouse", "keyboard", "touch"] as const)("should support onAction, interactionType: %s", async (interactionType) => {
    const onAction = vi.fn();
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Test">
        <ListBoxItem id="cat" onAction={() => onAction()}>
          Cat
        </ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
      </ListBox>
    ));
    const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
    await tester.triggerOptionAction({ option: tester.getOptions()[0]!, interactionType });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should trigger onAction on double click if selectionBehavior="replace"', async () => {
    const onAction = vi.fn();
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Test" selectionMode="multiple" selectionBehavior="replace" onAction={(key) => onAction(key)}>
        <ListBoxItem id="cat">Cat</ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
      </ListBox>
    ));
    const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
    const options = tester.getOptions();
    await tester.triggerOptionAction({ option: options[0]! });
    expect(tester.getSelectedOptions()).toHaveLength(1);
    expect(onAction).not.toHaveBeenCalled();
    await tester.triggerOptionAction({ option: options[1]!, needsDoubleClick: true });
    expect(tester.getSelectedOptions()).toHaveLength(1);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  describe('selectionBehavior="replace"', () => {
    describe.each(["mouse", "keyboard", "touch"] as const)("%s", (type) => {
      it("should perform selection with single selection", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderListbox({ selectionMode: "single", selectionBehavior: "replace", onSelectionChange: (k) => onSelectionChange(k) });
        const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox"), interactionType: type });
        const options = tester.getOptions();
        expect(onSelectionChange).toHaveBeenCalledTimes(0);
        const option2 = options[2]!;
        await tester.toggleOptionSelection({ option: "Kangaroo", selectionBehavior: "replace" });
        expect(option2).toHaveAttribute("aria-selected", "true");
        expect(option2).toHaveAttribute("data-selected", "true");
        // Keyboard: initial focus selects the first keyboard focused row.
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 2 : 1);
        expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["kangaroo"]));
        expect(tester.getSelectedOptions()).toHaveLength(1);
        expect(tester.getSelectedOptions()[0]).toBe(option2);

        const option1 = options[1]!;
        await tester.toggleOptionSelection({ option: option1, selectionBehavior: "replace" });
        expect(option1).toHaveAttribute("aria-selected", "true");
        expect(option1).toHaveAttribute("data-selected", "true");
        expect(option2).toHaveAttribute("aria-selected", "false");
        expect(option2).not.toHaveAttribute("data-selected");
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 3 : 2);
        expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["dog"]));
        expect(tester.getSelectedOptions()).toHaveLength(1);
        expect(tester.getSelectedOptions()[0]).toBe(option1);

        await tester.toggleOptionSelection({ option: option1, selectionBehavior: "replace" });
        expect(option1).toHaveAttribute("aria-selected", "false");
        expect(option1).not.toHaveAttribute("data-selected");
        expect(option2).toHaveAttribute("aria-selected", "false");
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 3);
        expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set([]));
        expect(tester.getSelectedOptions()).toHaveLength(0);
      });

      it("should perform toggle selection in highlight mode when using modifier keys", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderListbox({ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: (k) => onSelectionChange(k) });
        const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox"), interactionType: type });
        const options = tester.getOptions();
        const option2 = options[2]!;
        await tester.toggleOptionSelection({ option: "Kangaroo", selectionBehavior: "replace" });
        expect(option2).toHaveAttribute("aria-selected", "true");
        expect(option2).toHaveAttribute("data-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["cat", "kangaroo"]));
          expect(tester.getSelectedOptions()).toHaveLength(2);
          expect(tester.getSelectedOptions()[1]).toBe(option2);
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(1);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["kangaroo"]));
          expect(tester.getSelectedOptions()).toHaveLength(1);
          expect(tester.getSelectedOptions()[0]).toBe(option2);
        }

        const option1 = options[1]!;
        await tester.toggleOptionSelection({ option: option1, selectionBehavior: "replace" });
        expect(option1).toHaveAttribute("aria-selected", "true");
        expect(option2).toHaveAttribute("aria-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["cat", "dog", "kangaroo"]));
          expect(tester.getSelectedOptions()).toHaveLength(3);
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["dog", "kangaroo"]));
          expect(tester.getSelectedOptions()).toHaveLength(2);
          expect(tester.getSelectedOptions()[0]).toBe(option1);
          expect(tester.getSelectedOptions()[1]).toBe(option2);
        }

        // With modifier key, you should be able to deselect on press of the same row
        await tester.toggleOptionSelection({ option: option1, selectionBehavior: "replace" });
        expect(option1).toHaveAttribute("aria-selected", "false");
        expect(option1).not.toHaveAttribute("data-selected");
        expect(option2).toHaveAttribute("aria-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(4);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["cat", "kangaroo"]));
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["kangaroo"]));
          expect(tester.getSelectedOptions()[0]).toBe(option2);
        }
      });

      it("should perform replace selection in highlight mode when not using modifier keys", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderListbox({ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: (k) => onSelectionChange(k) });
        const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox"), interactionType: type });
        const options = tester.getOptions();
        const option2 = options[2]!;
        await tester.toggleOptionSelection({ option: "Kangaroo" });
        expect(option2).toHaveAttribute("aria-selected", "true");
        // Keyboard: selection follows focus while arrowing to the target option.
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 3 : 1);
        expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["kangaroo"]));
        expect(tester.getSelectedOptions()).toHaveLength(1);

        const option1 = options[1]!;
        await tester.toggleOptionSelection({ option: option1 });
        if (type !== "touch") {
          expect(option1).toHaveAttribute("aria-selected", "true");
          expect(option2).toHaveAttribute("aria-selected", "false");
          expect(option2).not.toHaveAttribute("data-selected");
          expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 2);
          expect(new Set(onSelectionChange.mock.calls.at(-1)![0])).toEqual(new Set(["dog"]));
          // pressing without modifier keys won't deselect the row
          await tester.toggleOptionSelection({ option: option1 });
          expect(option1).toHaveAttribute("aria-selected", "true");
          expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 2);
          expect(tester.getSelectedOptions()).toHaveLength(1);
        } else {
          // touch always behaves as toggle
          expect(option1).toHaveAttribute("aria-selected", "true");
          expect(option2).toHaveAttribute("aria-selected", "true");
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(new Set(onSelectionChange.mock.calls[1]![0])).toEqual(new Set(["dog", "kangaroo"]));
          await tester.toggleOptionSelection({ option: option1 });
          expect(option1).toHaveAttribute("aria-selected", "false");
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(new Set(onSelectionChange.mock.calls[2]![0])).toEqual(new Set(["kangaroo"]));
          expect(tester.getSelectedOptions()[0]).toBe(option2);
        }
      });
    });
  });

  describe("with pointer events", () => {
    it("should trigger selection on long press if both onAction and selection exist (touch only)", async () => {
      const onAction = vi.fn();
      const { getByRole } = renderIt(() => (
        <ListBox aria-label="Test" selectionMode="multiple" selectionBehavior="toggle" onAction={(key) => onAction(key)}>
          <ListBoxItem id="cat">Cat</ListBoxItem>
          <ListBoxItem id="dog">Dog</ListBoxItem>
          <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
        </ListBox>
      ));
      const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox"), interactionType: "touch" });
      await tester.toggleOptionSelection({ option: tester.getOptions()[0]! });
      expect(tester.getSelectedOptions()).toHaveLength(0);
      expect(onAction).toHaveBeenCalledTimes(1);
      // Rivet: the tester's long press builds TouchEvents with plain-object touches (Chromium rejects them): pointer events.
      const target = tester.getOptions()[0]!;
      fireEvent.pointerDown(target, { pointerType: "touch", pointerId: 2, button: 0, isPrimary: true });
      await new Promise((resolve) => setTimeout(resolve, 600));
      fireEvent.pointerUp(target, { pointerType: "touch", pointerId: 2, button: 0, isPrimary: true });
      fireEvent.click(target, { detail: 1 });
      expect(tester.getSelectedOptions()).toHaveLength(1);
      expect(tester.getSelectedOptions()[0]).toBe(tester.getOptions()[0]);
      expect(onAction).toHaveBeenCalledTimes(1);
      await tester.toggleOptionSelection({ option: tester.getOptions()[1]! });
      expect(tester.getSelectedOptions()).toHaveLength(2);
      expect(tester.getSelectedOptions()[1]).toBe(tester.getOptions()[1]);
    });
  });

  it("should support onAction on list and list items", async () => {
    const onAction = vi.fn();
    const itemAction = vi.fn();
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Test" onAction={(key) => onAction(key)}>
        <ListBoxItem id="cat" onAction={() => itemAction()}>
          Cat
        </ListBoxItem>
        <ListBoxItem id="dog">Dog</ListBoxItem>
        <ListBoxItem id="kangaroo">Kangaroo</ListBoxItem>
      </ListBox>
    ));
    await user.click(getAllByRole("option")[0]!);
    expect(onAction).toHaveBeenCalledWith("cat");
    expect(itemAction).toHaveBeenCalledTimes(1);
  });

  it("should support empty state", () => {
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Test" renderEmptyState={() => "No results"}>
        {[]}
      </ListBox>
    ));
    expect(getByRole("listbox")).toHaveAttribute("data-empty", "true");
    expect(getByRole("option")).toHaveTextContent("No results");
  });

  const gridRects = (width: number) =>
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "listbox") return { top: 0, left: 0, bottom: 200, right: width, width, height: 200, x: 0, y: 0 } as DOMRect;
      const index = [...this.parentElement!.children].indexOf(this);
      const top = (index % 3) * 40;
      const left = Math.floor(index / 3) * 100;
      return { top, left, bottom: top + 40, right: left + 100, width: 100, height: 40, x: left, y: top } as DOMRect;
    });

  const keyPress = (key: string) => {
    fireEvent.keyDown(document.activeElement!, { key });
    fireEvent.keyUp(document.activeElement!, { key });
  };

  it("should support horizontal orientation", async () => {
    const { getAllByRole } = renderListbox({ orientation: "horizontal" });
    const options = getAllByRole("option");
    await user.tab();
    expect(document.activeElement).toBe(options[0]);
    keyPress("ArrowRight");
    expect(document.activeElement).toBe(options[1]);
    keyPress("ArrowRight");
    expect(document.activeElement).toBe(options[2]);
    keyPress("ArrowLeft");
    expect(document.activeElement).toBe(options[1]);
  });

  it("should support grid layout", async () => {
    const { getAllByRole } = renderListbox({ layout: "grid" });
    const options = getAllByRole("option");
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute("role") === "listbox") return { top: 0, left: 0, bottom: 200, right: 200, width: 200, height: 200, x: 0, y: 0 } as DOMRect;
      const index = [...this.parentElement!.children].indexOf(this);
      return {
        top: Math.floor(index / 2) * 40,
        left: index % 2 ? 100 : 0,
        bottom: Math.floor(index / 2) * 40 + 40,
        right: index % 2 ? 200 : 100,
        width: 100,
        height: 40,
      } as DOMRect;
    });
    try {
      await user.tab();
      expect(document.activeElement).toBe(options[0]);
      keyPress("ArrowDown");
      expect(document.activeElement).toBe(options[2]);
      keyPress("ArrowLeft");
      expect(document.activeElement).toBe(options[1]);
      keyPress("ArrowLeft");
      expect(document.activeElement).toBe(options[0]);
      keyPress("ArrowRight");
      expect(document.activeElement).toBe(options[1]);
    } finally {
      spy.mockRestore();
    }
  });

  it("should not throw TypeError at boundaries of horizontal grid layout when keyboard navigating (left/right)", async () => {
    const { getAllByRole } = renderIt(() => (
      <ListBox layout="grid" orientation="horizontal" aria-label="Test">
        <ListBoxItem>1,1</ListBoxItem>
        <ListBoxItem>1,2</ListBoxItem>
        <ListBoxItem>1,3</ListBoxItem>
        <ListBoxItem>2,1</ListBoxItem>
        <ListBoxItem>2,2</ListBoxItem>
        <ListBoxItem>2,3</ListBoxItem>
        <ListBoxItem>3,1</ListBoxItem>
        <ListBoxItem>3,2</ListBoxItem>
        <ListBoxItem>3,3</ListBoxItem>
      </ListBox>
    ));
    const options = getAllByRole("option");
    const spy = gridRects(300);
    try {
      await user.tab();
      expect(document.activeElement).toBe(options[0]);
      keyPress("ArrowRight");
      expect(document.activeElement).toBe(options[3]);
      keyPress("ArrowRight");
      expect(document.activeElement).toBe(options[6]);
      keyPress("ArrowRight");
      expect(document.activeElement).toBe(options[6]);
      keyPress("ArrowLeft");
      expect(document.activeElement).toBe(options[3]);
      keyPress("ArrowLeft");
      expect(document.activeElement).toBe(options[0]);
      keyPress("ArrowLeft");
      expect(document.activeElement).toBe(options[0]);
    } finally {
      spy.mockRestore();
    }
  });

  it("should support keyboard navigation across grid layout via the test util", async () => {
    const { getByRole } = renderIt(() => (
      <ListBox layout="grid" aria-label="Test" selectionMode="single">
        <ListBoxItem>1,1</ListBoxItem>
        <ListBoxItem>1,2</ListBoxItem>
        <ListBoxItem>1,3</ListBoxItem>
        <ListBoxItem>2,1</ListBoxItem>
        <ListBoxItem>2,2</ListBoxItem>
        <ListBoxItem>2,3</ListBoxItem>
        <ListBoxItem>3,1</ListBoxItem>
        <ListBoxItem>3,2</ListBoxItem>
        <ListBoxItem>3,3</ListBoxItem>
      </ListBox>
    ));
    const spy = gridRects(300);
    try {
      const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox"), interactionType: "keyboard", layout: "grid" });
      const options = tester.getOptions();
      await tester.toggleOptionSelection({ option: options[5]! });
      expect(options[5]).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(options[5]);
      await tester.toggleOptionSelection({ option: "1,1" });
      expect(options[0]).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(options[0]);
      await tester.toggleOptionSelection({ option: 8 });
      expect(options[8]).toHaveAttribute("aria-selected", "true");
      expect(document.activeElement).toBe(options[8]);
    } finally {
      spy.mockRestore();
    }
  });

  it("should support onScroll", () => {
    const onScroll = vi.fn();
    const { getByRole } = renderListbox({ onScroll: (e: Event) => onScroll(e) } as never);
    fireEvent.scroll(getByRole("listbox"));
    expect(onScroll).toHaveBeenCalled();
  });

  it('should prevent Esc from clearing selection if escapeKeyBehavior is "none"', async () => {
    const { getByRole } = renderListbox({ selectionMode: "multiple", escapeKeyBehavior: "none" });
    const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
    const option = tester.getOptions()[0]!;
    expect(option).not.toHaveAttribute("aria-selected", "true");
    await tester.toggleOptionSelection({ option });
    expect(option).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(option).toHaveAttribute("aria-selected", "true");
  });

  const FalsyExample = () => (
    <ListBox aria-label="Test" selectionMode="multiple" selectionBehavior="replace">
      <ListBoxItem id="0">Item 0</ListBoxItem>
      <ListBoxItem id="1">Item 1</ListBoxItem>
      <ListBoxItem id="2">Item 2</ListBoxItem>
    </ListBox>
  );

  describe("selection with falsy keys", () => {
    describe("keyboard", () => {
      it("should deselect item 0 when navigating back in replace selection mode", async () => {
        const { getAllByRole } = renderIt(() => <FalsyExample />);
        const items = getAllByRole("option");
        await user.click(items[1]!);
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        expect(items[2]).toHaveAttribute("aria-selected", "false");
        await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
        expect(items[0]).toHaveAttribute("aria-selected", "false");
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        expect(items[2]).toHaveAttribute("aria-selected", "false");
      });

      it("should correctly handle starting selection at item 0 and extending to item 2", async () => {
        const { getAllByRole } = renderIt(() => <FalsyExample />);
        const items = getAllByRole("option");
        await user.click(items[0]!);
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        expect(items[2]).toHaveAttribute("aria-selected", "false");
        await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        expect(items[2]).toHaveAttribute("aria-selected", "true");
      });
    });

    describe("mouse", () => {
      it("should deselect item 0 when clicking another item in replace selection mode", async () => {
        const { getAllByRole } = renderIt(() => <FalsyExample />);
        const items = getAllByRole("option");
        await user.click(items[1]!);
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        await user.click(items[0]!);
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        expect(items[1]).toHaveAttribute("aria-selected", "false");
        await user.click(items[1]!);
        expect(items[1]).toHaveAttribute("aria-selected", "true");
        expect(items[0]).toHaveAttribute("aria-selected", "false");
      });

      it("should correctly handle mouse selection starting at item 0 and extending to item 2", async () => {
        const { getAllByRole } = renderIt(() => <FalsyExample />);
        const items = getAllByRole("option");
        await user.click(items[0]!);
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        await user.click(items[2]!);
        expect(items[0]).toHaveAttribute("aria-selected", "false");
        expect(items[2]).toHaveAttribute("aria-selected", "true");
      });
    });
  });

  describe("shouldSelectOnPressUp", () => {
    it.each([
      ["not provided", undefined, 1],
      ["false", false, 1],
      ["true", true, 0],
    ] as const)("should select an item on the right pointer phase when shouldSelectOnPressUp is %s", async (_label, shouldSelectOnPressUp, onDown) => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderListbox({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k), shouldSelectOnPressUp });
      const items = getAllByRole("option");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(onDown);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("shouldFocusOnHover", () => {
    it("should focus options on hovering with shouldFocusOnHover", async () => {
      const { getAllByRole } = renderListbox({ shouldFocusOnHover: true });
      const [option1, option2] = getAllByRole("option");
      expect(option1).not.toHaveFocus();
      expect(option2).not.toHaveFocus();
      await user.hover(option1!);
      expect(option1).toHaveFocus();
      keyPress("ArrowDown");
      expect(option1).not.toHaveFocus();
      expect(option2).toHaveFocus();
    });

    it.each([false, undefined])("should not focus options on hovering when shouldFocusOnHover is not true (%s)", async (shouldFocusOnHover) => {
      const { getAllByRole } = renderListbox({ shouldFocusOnHover });
      const option = getAllByRole("option")[0]!;
      await user.hover(option);
      expect(option).not.toHaveFocus();
    });
  });

  describe("async loading", () => {
    const items = [{ name: "Foo" }, { name: "Bar" }, { name: "Baz" }];
    const asyncListbox = (p: { items: () => { name: string }[]; isLoading?: () => boolean; onLoadMore?: () => void }) => {
      const onLoadMore = p.onLoadMore;
      return renderIt(() => (
        <ListBox aria-label="async listbox" renderEmptyState={() => <div>empty state</div>}>
          <Collection items={p.items}>{(item: { name: string }) => <ListBoxItem id={item.name}>{item.name}</ListBoxItem>}</Collection>
          <ListBoxLoadMoreItem isLoading={p.isLoading} onLoadMore={onLoadMore ? () => onLoadMore() : undefined}>
            Loading...
          </ListBoxLoadMoreItem>
        </ListBox>
      ));
    };

    it("should render the loading element when loading", () => {
      const tree = asyncListbox({ items: () => items, isLoading: () => true });
      const options = testUtilUser.createTester("ListBox", { root: tree.getByRole("listbox") }).getOptions();
      expect(options).toHaveLength(4);
      expect(options[3]).toHaveTextContent("Loading...");
      expect(tree.getByTestId("loadMoreSentinel").parentElement).toHaveAttribute("inert");
    });

    it("should render the sentinel but not the loading indicator when not loading", () => {
      const tree = asyncListbox({ items: () => items });
      const options = testUtilUser.createTester("ListBox", { root: tree.getByRole("listbox") }).getOptions();
      expect(options).toHaveLength(3);
      expect(tree.queryByText("Loading...")).toBeFalsy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
    });

    it("should properly render the renderEmptyState if listbox is empty", async () => {
      const isLoading = signal(false);
      const tree = asyncListbox({ items: () => [], isLoading: () => isLoading() });
      const tester = testUtilUser.createTester("ListBox", { root: tree.getByRole("listbox") });
      let options = tester.getOptions();
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent("empty state");
      expect(tree.queryByText("Loading...")).toBeFalsy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
      isLoading.set(true);
      await flush();
      options = tester.getOptions();
      expect(options).toHaveLength(2);
      expect(options[1]).toHaveTextContent("empty state");
      expect(tree.queryByText("Loading...")).toBeTruthy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
    });

    it("should only fire loadMore when intersection is detected regardless of loading state", async () => {
      const observe = vi.fn();
      let callback: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;
      class MockObserver {
        constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          callback = cb;
        }
        observe = observe;
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
      vi.stubGlobal("IntersectionObserver", MockObserver);
      try {
        const onLoadMore = vi.fn();
        const isLoading = signal(true);
        const tree = asyncListbox({ items: () => items, isLoading: () => isLoading(), onLoadMore: () => onLoadMore() });
        await flush();
        const sentinel = tree.getByTestId("loadMoreSentinel");
        expect(observe).toHaveBeenLastCalledWith(sentinel);
        expect(onLoadMore).toHaveBeenCalledTimes(0);
        callback!([{ isIntersecting: true }]);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        observe.mockClear();
        isLoading.set(false);
        await flush();
        expect(observe).toHaveBeenLastCalledWith(sentinel);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        callback!([{ isIntersecting: true }]);
        expect(onLoadMore).toHaveBeenCalledTimes(2);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe("onKeyDown", () => {
    it("should call key handler when key is pressed on item", async () => {
      const onKeyDown = vi.fn((e: { continuePropagation(): void }) => e.continuePropagation());
      const onKeyUp = vi.fn();
      const onSelectionChange = vi.fn();
      renderListbox({ selectionMode: "multiple", onSelectionChange: (k) => onSelectionChange(k) }, {
        onKeyDown: (e: never) => onKeyDown(e),
        onKeyUp: (e: never) => onKeyUp(e),
      } as never);
      await user.tab();
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      onKeyUp.mockClear();
      await user.keyboard("{Enter}");
      expect(onKeyDown).toHaveBeenCalledTimes(1);
      expect(onKeyUp).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      await user.keyboard("{Escape}");
      expect(onKeyDown).toHaveBeenCalledTimes(2);
      expect(onKeyUp).toHaveBeenCalledTimes(2);
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
    });
  });

  // Rivet addition (RA useOption `isDisabled ?? manager.isDisabled(key)`): with disabledBehavior="selection" an
  // item's own isDisabled leaves it focusable (no aria-disabled) but not selectable.
  it('should keep isDisabled items focusable but unselectable with disabledBehavior="selection"', async () => {
    const { getAllByRole } = renderIt(() => (
      <ListBox aria-label="Test" selectionMode="multiple" disabledBehavior="selection">
        <ListBoxItem id="a">A</ListBoxItem>
        <ListBoxItem id="b" isDisabled>
          B
        </ListBoxItem>
      </ListBox>
    ));
    const [a, b] = getAllByRole("option");
    expect(b).not.toHaveAttribute("aria-disabled");
    await user.click(a!);
    keyPress("ArrowDown");
    expect(document.activeElement).toBe(b);
    keyPress(" ");
    expect(b).toHaveAttribute("aria-selected", "false");
  });

  // Rivet addition (RA useListBox listData UNSTABLE_itemBehavior, used by ComboBox): action items never select.
  it('should treat items with onAction as actions only with UNSTABLE_itemBehavior="action"', async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderListbox({
      selectionMode: "multiple",
      defaultSelectedKeys: ["kangaroo"],
      UNSTABLE_itemBehavior: "action",
      onAction: (k: unknown) => onAction(k),
    } as never);
    const options = getAllByRole("option");
    // A non-empty selection would make a click toggle; the action override keeps it an action.
    await user.click(options[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  // Rivet addition: sections forward global DOM attributes and events (RAC filterDOMProps global).
  it("should forward global DOM props and events on sections", () => {
    const onWheel = vi.fn();
    const { getByRole } = renderIt(() => (
      <ListBox aria-label="Test">
        <ListBoxSection lang="de" onWheel={() => onWheel()}>
          <Header>More</Header>
          <ListBoxItem id="plum">Plum</ListBoxItem>
        </ListBoxSection>
      </ListBox>
    ));
    const group = getByRole("group");
    expect(group).toHaveAttribute("lang", "de");
    fireEvent.wheel(getByRole("option"));
    expect(onWheel).toHaveBeenCalledTimes(1);
  });

  describe("links", () => {
    const mockClickDefault = () => {
      const onClick = vi.fn((e: MouseEvent) => e.preventDefault());
      window.addEventListener("click", onClick);
      cleanups.push(() => window.removeEventListener("click", onClick));
      return onClick;
    };
    const cleanups: (() => void)[] = [];
    afterEach(() => cleanups.splice(0).forEach((f) => f()));
    describe.each(["mouse", "keyboard"] as const)("%s", (type) => {
      const trigger = async (item: HTMLElement) => {
        if (type === "mouse") await user.click(item);
        else {
          fireEvent.keyDown(item, { key: "Enter" });
          fireEvent.keyUp(item, { key: "Enter" });
        }
      };

      it('should support links with selectionMode="none"', async () => {
        const { getAllByRole } = renderIt(() => (
          <ListBox aria-label="listbox">
            <ListBoxItem href="https://google.com">One</ListBoxItem>
            <ListBoxItem href="https://adobe.com">Two</ListBoxItem>
          </ListBox>
        ));
        const items = getAllByRole("option");
        for (const item of items) {
          expect(item.tagName).toBe("A");
          expect(item).toHaveAttribute("href");
        }
        const onClick = mockClickDefault();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0]![0].target).toBeInstanceOf(HTMLAnchorElement);
        expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionMode="%s"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => (
          <ListBox aria-label="listbox" selectionMode={selectionMode}>
            <ListBoxItem href="https://google.com">One</ListBoxItem>
            <ListBoxItem href="https://adobe.com">Two</ListBoxItem>
          </ListBox>
        ));
        const items = getAllByRole("option");
        const onClick = mockClickDefault();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
        expect(items[0]).not.toHaveAttribute("aria-selected", "true");
        await trigger(items[1]!);
        expect(onClick).toHaveBeenCalledTimes(2);
        expect((onClick.mock.calls[1]![0].target as HTMLAnchorElement).href).toBe("https://adobe.com/");
        expect(items[1]).not.toHaveAttribute("aria-selected", "true");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionMode="%s" selectionBehavior="replace"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => (
          <ListBox aria-label="listbox" selectionMode={selectionMode} selectionBehavior="replace">
            <ListBoxItem href="https://google.com">One</ListBoxItem>
            <ListBoxItem href="https://adobe.com">Two</ListBoxItem>
          </ListBox>
        ));
        const items = getAllByRole("option");
        const onClick = mockClickDefault();
        if (type === "mouse") await user.click(items[0]!);
        else {
          fireEvent.keyDown(items[0]!, { key: " " });
          fireEvent.keyUp(items[0]!, { key: " " });
        }
        expect(onClick).not.toHaveBeenCalled();
        expect(items[0]).toHaveAttribute("aria-selected", "true");
        if (type === "mouse") await user.dblClick(items[0]!);
        else {
          fireEvent.keyDown(items[0]!, { key: "Enter" });
          fireEvent.keyUp(items[0]!, { key: "Enter" });
        }
        expect(onClick).toHaveBeenCalledTimes(1);
        expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
      });
    });

    // Rivet addition (RA useSelectableItem `router.open`): link options open through RouterProvider.
    it("should navigate link options through a RouterProvider", async () => {
      const navigate = vi.fn();
      const { getAllByRole } = renderIt(() => (
        <RouterProvider navigate={(path, options) => navigate(path, options)}>
          <ListBox aria-label="listbox">
            <ListBoxItem href="/one">One</ListBoxItem>
            <ListBoxItem href="/two">Two</ListBoxItem>
          </ListBox>
        </RouterProvider>
      ));
      const onClick = mockClickDefault();
      await user.click(getAllByRole("option")[1]!);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate.mock.calls[0]![0]).toBe("/two");
      // The router navigated: no native link click reached the window.
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("press events", () => {
    it.each(["mouse", "keyboard"] as const)("should support press events on items when using %s", async (interactionType) => {
      const onAction = vi.fn();
      const onPressStart = vi.fn();
      const onPressEnd = vi.fn();
      const onPress = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = renderListbox(
        {},
        {
          onAction: () => onAction(),
          onPressStart: (e) => onPressStart(e),
          onPressEnd: (e) => onPressEnd(e),
          onPress: (e) => onPress(e),
          onClick: (e) => onClick(e),
        },
      );
      const tester = testUtilUser.createTester("ListBox", { root: getByRole("listbox") });
      await tester.triggerOptionAction({ option: 1, interactionType });
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onPressStart).toHaveBeenCalledTimes(1);
      expect(onPressEnd).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    // Rivet addition (RA usePress onClick stopPropagation): a handled option click does not bubble.
    it("should stop propagation of a handled option click", async () => {
      const outer = vi.fn();
      const { getAllByRole } = renderIt(() => (
        <div onClick={() => outer()}>
          <ListBox aria-label="Test" selectionMode="single">
            <ListBoxItem id="cat">Cat</ListBoxItem>
          </ListBox>
        </div>
      ));
      await user.click(getAllByRole("option")[0]!);
      expect(getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
      expect(outer).not.toHaveBeenCalled();
    });
  });
});

void Collection;
void ListBoxLoadMoreItem;
