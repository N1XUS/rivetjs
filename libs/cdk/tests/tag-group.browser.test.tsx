// Ported from react-aria-components test/TagGroup.test.js and react-aria test/tag/useTagGroup.test.js
// (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries from `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isHovered()`); `jest.fn` → `vi.fn`; `userEvent.setup()` (real
// timers); `React.createRef` → `ref()`; `useListData` → `createListData`; testers from `@rivetjs/testing/user`; default
// classes `rv-*`. useTagGroup.test.js (hooks over `<Item>` collections) runs against the RAC parts.
import { afterEach, beforeAll, describe, expect, it, vi, type Mock } from "vitest";
import "@rivetjs/testing/jest-dom";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Label } from "../label/index.tsx";
import { Text } from "../text/index.tsx";
import { RouterProvider } from "../utils/links.tsx";
import { createListData } from "../data/index.tsx";
import { Tag, TagGroup, TagList, type TagGroupProps, type TagListProps, type TagProps } from "../tag-group/index.tsx";

afterEach(cleanup);

const RemovableTag = (p: TagProps & { children: string }) => {
  const label = p.children;
  return (
    <Tag textValue={label} {...p}>
      {({ allowsRemoving }: { allowsRemoving: boolean }) => (
        <>
          {label}
          {allowsRemoving ? <Button slot="remove">x</Button> : null}
        </>
      )}
    </Tag>
  );
};

const TestTagGroup = (p: { tagGroupProps?: Partial<TagGroupProps>; tagListProps?: Partial<TagListProps>; itemProps?: Partial<TagProps> }) => {
  const itemProps = p.itemProps ?? {};
  return (
    <TagGroup data-testid="group" {...(p.tagGroupProps ?? {})}>
      <Label>Test</Label>
      <TagList {...(p.tagListProps ?? {})}>
        <RemovableTag {...itemProps} id="cat">
          Cat
        </RemovableTag>
        <RemovableTag {...itemProps} id="dog">
          Dog
        </RemovableTag>
        <RemovableTag {...itemProps} id="kangaroo">
          Kangaroo
        </RemovableTag>
      </TagList>
      <Text slot="description">Description</Text>
      <Text slot="errorMessage">Error</Text>
    </TagGroup>
  );
};

const renderIt = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);
const renderTagGroup = (tagGroupProps?: Partial<TagGroupProps>, tagListProps?: Partial<TagListProps>, itemProps?: Partial<TagProps>) =>
  renderIt(() => <TestTagGroup tagGroupProps={tagGroupProps} tagListProps={tagListProps} itemProps={itemProps} />);

describe("TagGroup", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) });
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render with default classes", () => {
    const { getByRole, getAllByRole, getByTestId } = renderTagGroup();
    expect(getByTestId("group")).toHaveAttribute("class", "rv-TagGroup");
    expect(getByRole("grid")).toHaveAttribute("class", "rv-TagList");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("class", "rv-Tag");
  });

  it("should render with custom classes", () => {
    const { getByRole, getAllByRole, getByTestId } = renderTagGroup({ class: "taggroup" }, { class: "taglist" }, { class: "item" });
    expect(getByTestId("group")).toHaveAttribute("class", "taggroup");
    expect(getByRole("grid")).toHaveAttribute("class", "taglist");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("class", "item");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole, getByTestId } = renderTagGroup(
      { "data-foo": "bar" } as never,
      { "data-baz": "baz" } as never,
      { "data-bar": "foo" } as never,
    );
    expect(getByTestId("group")).toHaveAttribute("data-foo", "bar");
    expect(getByRole("grid")).toHaveAttribute("data-baz", "baz");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("data-bar", "foo");
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support refs", async () => {
    const tagGroupRef = ref<HTMLDivElement>();
    const tagListRef = ref<HTMLDivElement>();
    const itemRef = ref<HTMLDivElement>();
    render(() => (
      <TagGroup aria-label="Test" ref={tagGroupRef}>
        <TagList ref={tagListRef}>
          <Tag ref={itemRef}>Cat</Tag>
        </TagList>
      </TagGroup>
    ));
    await flush();
    expect(tagGroupRef()).toBeInstanceOf(HTMLElement);
    expect(tagListRef()).toBeInstanceOf(HTMLElement);
    expect(itemRef()).toBeInstanceOf(HTMLElement);
  });

  it("provides slots for description and error message", async () => {
    const { getByRole } = renderTagGroup();
    await flush();
    const grid = getByRole("grid");
    expect(grid).toHaveAttribute("aria-labelledby");
    const label = document.getElementById(grid.getAttribute("aria-labelledby")!);
    expect(label).toHaveAttribute("class", "rv-Label");
    expect(label).toHaveTextContent("Test");
    expect(grid).toHaveAttribute("aria-describedby");
    expect(
      grid
        .getAttribute("aria-describedby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" "),
    ).toBe("Description Error");
  });

  it("should support hover", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderTagGroup({ selectionMode: "multiple" }, {}, {
      class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
      onHoverStart: (e: unknown) => onHoverStart(e),
      onHoverChange: (h: unknown) => onHoverChange(h),
      onHoverEnd: (e: unknown) => onHoverEnd(e),
    } as never);
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    await user.hover(row);
    expect(row).toHaveAttribute("data-hovered", "true");
    expect(row).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(1);
    await user.unhover(row);
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    expect(onHoverEnd).toHaveBeenCalledTimes(1);
    expect(onHoverChange).toHaveBeenCalledTimes(2);
  });

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const { getAllByRole } = renderTagGroup({}, {}, {
      class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
      onHoverStart: (e: unknown) => onHoverStart(e),
    } as never);
    const row = getAllByRole("row")[0]!;
    await user.hover(row);
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
  });

  it("should show hover state when tag has an href even without selectionMode", async () => {
    const onHoverStart = vi.fn();
    const { getAllByRole } = renderTagGroup({}, {}, {
      href: "/",
      class: ({ isHovered }: { isHovered: () => boolean }) => (isHovered() ? "hover" : ""),
      onHoverStart: (e: unknown) => onHoverStart(e),
    } as never);
    const row = getAllByRole("row")[0]!;
    await user.hover(row);
    expect(row).toHaveAttribute("data-hovered", "true");
    expect(row).toHaveClass("hover");
    expect(onHoverStart).toHaveBeenCalledTimes(1);
    await user.unhover(row);
    expect(row).not.toHaveAttribute("data-hovered");
  });

  it("should support focus ring", async () => {
    const onFocus = vi.fn();
    const onFocusChange = vi.fn();
    const onBlur = vi.fn();
    const { getAllByRole } = renderTagGroup({ selectionMode: "multiple" }, {}, {
      class: ({ isFocusVisible }: { isFocusVisible: () => boolean }) => (isFocusVisible() ? "focus" : ""),
      onFocus: (e: unknown) => onFocus(e),
      onFocusChange: (f: unknown) => onFocusChange(f),
      onBlur: (e: unknown) => onBlur(e),
    } as never);
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("data-focus-visible");
    await user.tab();
    expect(document.activeElement).toBe(row);
    expect(row).toHaveAttribute("data-focus-visible", "true");
    expect(row).toHaveClass("focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();
    onFocus.mockClear();
    onFocusChange.mockClear();
    onBlur.mockClear();
    fireEvent.keyDown(row, { key: "ArrowDown" });
    fireEvent.keyUp(row, { key: "ArrowDown" });
    expect(row).not.toHaveAttribute("data-focus-visible");
    expect(row).not.toHaveClass("focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledTimes(2); // once for each tag
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderTagGroup({ selectionMode: "multiple" }, {}, {
      class: ({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : ""),
    } as never);
    const row = getAllByRole("row")[0]!;
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).toHaveAttribute("data-pressed", "true");
    expect(row).toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
  });

  it("should not show press state when not interactive", async () => {
    const { getAllByRole } = renderTagGroup({}, {}, { class: ({ isPressed }: { isPressed: () => boolean }) => (isPressed() ? "pressed" : "") } as never);
    const row = getAllByRole("row")[0]!;
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
  });

  it("should support selection state", async () => {
    const { getAllByRole } = renderTagGroup({ selectionMode: "multiple" }, {}, {
      class: ({ isSelected }: { isSelected: () => boolean }) => (isSelected() ? "selected" : ""),
    } as never);
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("aria-selected", "true");
    await user.click(row);
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row).toHaveClass("selected");
    await user.click(row);
    expect(row).not.toHaveAttribute("aria-selected", "true");
    expect(row).not.toHaveClass("selected");
  });

  it("should support disabled state", () => {
    const { getAllByRole } = renderTagGroup({ selectionMode: "multiple", disabledKeys: ["cat"] }, {}, {
      class: ({ isDisabled }: { isDisabled: () => boolean }) => (isDisabled() ? "disabled" : ""),
    } as never);
    const row = getAllByRole("row")[0]!;
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveClass("disabled");
  });

  it("should support isDisabled prop on items", async () => {
    const { getAllByRole } = renderIt(() => (
      <TagGroup data-testid="group">
        <Label>Test</Label>
        <TagList>
          <RemovableTag id="cat">Cat</RemovableTag>
          <RemovableTag id="dog" isDisabled>
            Dog
          </RemovableTag>
          <RemovableTag id="kangaroo">Kangaroo</RemovableTag>
        </TagList>
      </TagGroup>
    ));
    const items = getAllByRole("row");
    expect(items[1]).toHaveAttribute("aria-disabled", "true");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[2]);
  });

  it("should support removing items", async () => {
    const onRemove = vi.fn();
    const { getAllByRole } = renderTagGroup({ onRemove: (k) => onRemove(k) }, {}, {
      class: ({ allowsRemoving }: { allowsRemoving: boolean }) => (allowsRemoving ? "removable" : ""),
    } as never);
    const row = getAllByRole("row")[0]!;
    expect(row).toHaveAttribute("data-allows-removing", "true");
    expect(row).toHaveClass("removable");
    const button = getAllByRole("button")[0]!;
    expect(button).toHaveAttribute("aria-label", "Remove");
    await user.click(button);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("should support repeat keydown events when holding the remove key", async () => {
    const removed: unknown[] = [];
    const Example = () => {
      const list = createListData({
        initialItems: [
          { id: "cat", name: "Cat" },
          { id: "dog", name: "Dog" },
          { id: "kangaroo", name: "Kangaroo" },
        ],
      });
      return (
        <TagGroup
          aria-label="Animals"
          onRemove={(keys) => {
            removed.push(...keys);
            list.remove(...keys);
          }}
        >
          <TagList items={list.items}>
            {(item: { id: string; name: string }) => (
              <Tag textValue={item.name}>
                {item.name}
                <Button slot="remove" aria-label="remove" />
              </Tag>
            )}
          </TagList>
        </TagGroup>
      );
    };
    const { getAllByRole, queryAllByRole } = renderIt(() => <Example />);
    expect(getAllByRole("row")).toHaveLength(3);
    await user.tab();
    expect(getAllByRole("row")[0]).toHaveFocus();
    // Hold the key down for three keydown events. Each removes the focused tag and shifts focus to the next one.
    await user.keyboard("{Backspace>3/}");
    await flush();
    expect(queryAllByRole("row")).toHaveLength(0);
    expect(removed).toEqual(["cat", "dog", "kangaroo"]);
  });

  it("should disable the remove button if the tag is disabled", async () => {
    const onRemove = vi.fn();
    const { getAllByRole } = renderIt(() => (
      <TagGroup data-testid="group" onRemove={(k) => onRemove(k)} disabledKeys={new Set(["dog"])}>
        <Label>Test</Label>
        <TagList>
          <RemovableTag id="cat">Cat</RemovableTag>
          <RemovableTag id="dog">Dog</RemovableTag>
          <RemovableTag id="kangaroo">Kangaroo</RemovableTag>
        </TagList>
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
      </TagGroup>
    ));
    expect(getAllByRole("row")[0]).toHaveAttribute("data-allows-removing", "true");
    const button = getAllByRole("button", { hidden: true })[1]!;
    expect(button).toHaveAttribute("aria-label", "Remove");
    expect(button).toHaveAttribute("disabled");
    await user.click(button);
    expect(onRemove).toHaveBeenCalledTimes(0);
  });

  it("should support empty state", () => {
    const { getByTestId } = renderIt(() => (
      <TagGroup data-testid="group">
        <Label>Test</Label>
        <TagList data-testid="list" renderEmptyState={() => "No results"} items={[]}>
          {() => null}
        </TagList>
      </TagGroup>
    ));
    const grid = getByTestId("list");
    expect(grid).toHaveAttribute("data-empty", "true");
    expect(grid).toHaveTextContent("No results");
    expect(grid).toHaveAttribute("role", "group");
  });

  // TODO(C1b TooltipTrigger in collections): TooltipTrigger around a Tag inside a TagList is not wired.
  it.skip("supports tooltips", () => {});

  describe("supports links", () => {
    describe.each(["mouse", "keyboard"] as const)("%s", (type) => {
      const trigger = async (item: HTMLElement) => {
        if (type === "mouse") await user.click(item);
        else {
          fireEvent.keyDown(item, { key: "Enter" });
          fireEvent.keyUp(item, { key: "Enter" });
        }
      };
      let onClick: Mock<(e: Event) => void>;
      const mockClickDefault = () => {
        onClick = vi.fn((e: Event) => e.preventDefault());
        window.addEventListener("click", onClick);
        return onClick;
      };
      afterEach(() => window.removeEventListener("click", onClick));

      it.each(["none", "single", "multiple"] as const)("with selectionMode = %s", async (selectionMode) => {
        const onSelectionChange = vi.fn();
        const { getAllByRole } = renderIt(() => (
          <TagGroup selectionMode={selectionMode} onSelectionChange={(k) => onSelectionChange(k)}>
            <Label>Tags</Label>
            <TagList>
              <Tag href="https://google.com">One</Tag>
              <Tag href="https://adobe.com">Two</Tag>
              <Tag>Non link</Tag>
            </TagList>
          </TagGroup>
        ));
        const items = getAllByRole("row");
        expect(items).toHaveLength(3);
        expect(items[0]!.tagName).not.toBe("A");
        expect(items[0]).toHaveAttribute("data-href", "https://google.com");
        expect(items[1]).toHaveAttribute("data-href", "https://adobe.com");
        expect(items[2]).not.toHaveAttribute("data-href");
        const onClick = mockClickDefault();
        await trigger(items[1]!);
        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
        if (selectionMode !== "none") {
          await trigger(items[2]!);
          expect(onSelectionChange).toHaveBeenCalledTimes(1);
          expect(items[2]).toHaveAttribute("aria-selected", "true");
          await trigger(items[1]!);
          expect(onSelectionChange).toHaveBeenCalledTimes(1);
          expect(onClick).toHaveBeenCalledTimes(2);
        }
      });

      it("should work with RouterProvider", async () => {
        const navigate = vi.fn();
        const { getAllByRole } = renderIt(() => (
          <RouterProvider navigate={(path, options) => navigate(path, options)} useHref={(href) => "/base" + href}>
            <TagGroup selectionMode="none">
              <Label>Tags</Label>
              <TagList>
                <Tag href="/foo" routerOptions={{ foo: "bar" } as never}>
                  One
                </Tag>
              </TagList>
            </TagGroup>
          </RouterProvider>
        ));
        const items = getAllByRole("row");
        expect(items[0]).toHaveAttribute("data-href", "/base/foo");
        await trigger(items[0]!);
        expect(navigate).toHaveBeenCalledWith("/foo", { foo: "bar" });
      });
    });
  });

  it("if we cannot restore focus to next, then restore to previous but do not try focusing next again", async () => {
    const MyTagGroup = () => {
      const fruitsList = createListData({
        initialItems: [
          { id: 2, name: "Grape" },
          { id: 3, name: "Plum" },
          { id: 4, name: "Watermelon" },
        ],
      });
      return (
        <TagGroup data-testid="group" aria-label="Fruits" selectionMode="multiple" disabledKeys={[2, 3]} onRemove={(keys) => fruitsList.remove(...keys)}>
          <TagList items={fruitsList.items}>
            {(item: { id: number; name: string }) => (
              <Tag textValue={item.name}>
                {({ isDisabled }: { isDisabled: () => boolean }) => (
                  <>
                    {item.name}
                    <Button slot="remove" isDisabled={isDisabled} aria-label="remove" />
                  </>
                )}
              </Tag>
            )}
          </TagList>
        </TagGroup>
      );
    };
    const { getByRole, getAllByRole } = renderIt(() => <MyTagGroup />);
    const grid = getByRole("grid");
    const tags = getAllByRole("row");
    await user.tab();
    expect(tags[2]).toHaveFocus();
    await user.keyboard("{Backspace}");
    await flush();
    await new Promise((r) => setTimeout(r, 0));
    expect(grid).toHaveFocus();
  });

  it("disabled tags should not be deletable", async () => {
    const onRemove = vi.fn();
    const { getAllByRole, getByRole } = renderIt(() => (
      <>
        <TagGroup data-testid="group" onRemove={(k) => onRemove(k)} disabledKeys={["cat", "dog", "kangaroo"]}>
          <Label>Test</Label>
          <TagList>
            <RemovableTag id="cat">Cat</RemovableTag>
            <RemovableTag id="dog">Dog</RemovableTag>
            <RemovableTag id="kangaroo">Kangaroo</RemovableTag>
          </TagList>
          <Text slot="description">Description</Text>
          <Text slot="errorMessage">Error</Text>
        </TagGroup>
        <Button>Click here first</Button>
      </>
    ));
    const items = getAllByRole("row");
    items[2]!.focus();
    await user.keyboard("{Backspace}");
    expect(onRemove).not.toHaveBeenCalled();
    await user.click(getAllByRole("button")[3]!);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(getByRole("grid"));
  });

  it("should support tabbing to remove buttons", async () => {
    const onRemove = vi.fn();
    const { getAllByRole, getAllByText } = renderIt(() => (
      <TagGroup data-testid="group" onRemove={(k) => onRemove(k)}>
        <Label>Test</Label>
        <TagList>
          <RemovableTag id="cat">Cat</RemovableTag>
          <RemovableTag id="dog">Dog</RemovableTag>
          <RemovableTag id="kangaroo">Kangaroo</RemovableTag>
        </TagList>
        <Text slot="description">Description</Text>
        <Text slot="errorMessage">Error</Text>
      </TagGroup>
    ));
    const tags = getAllByRole("row");
    const removeButtons = getAllByText("x");
    expect(removeButtons).toHaveLength(3);
    await user.tab();
    expect(document.activeElement).toBe(tags[0]);
    await user.tab();
    expect(document.activeElement).toBe(removeButtons[0]);
    await user.keyboard(" ");
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["cat"]));
    await user.keyboard("{Delete}");
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["cat"]));
    await user.tab({ shift: true });
    expect(tags[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tags[1]).toHaveFocus();
    await user.keyboard("{Delete}");
    expect(onRemove).toHaveBeenCalledTimes(3);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["dog"]));
  });

  it("should maintain item order when adding new items", async () => {
    const Example = () => {
      const list = createListData<{ id: number; label: string }>({ initialItems: [] });
      const next = { id: 0 };
      return (
        <div>
          <Button
            onPress={() => {
              const id = next.id++;
              list.insert(0, { id, label: `Item ${id + 1}` });
            }}
          >
            Insert item
          </Button>
          <TagGroup onRemove={(keys) => list.remove(...keys)}>
            <Label>Categories</Label>
            <TagList items={list.items} renderEmptyState={() => "No categories."}>
              {(item: { id: number; label: string }) => (
                <Tag textValue={item.label}>
                  {item.label}
                  <Button slot="remove">X</Button>
                </Tag>
              )}
            </TagList>
          </TagGroup>
        </div>
      );
    };
    const { getAllByRole, queryAllByRole, getByRole } = renderIt(() => <Example />);
    const addButton = getAllByRole("button")[0]!;
    const tagGroup = getByRole("group");
    for (let i = 0; i < 4; i++) await user.click(addButton);
    await flush();
    let items = getAllByRole("row");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Item 4");
    await user.tab();
    for (const [left, first] of [
      [3, "Item 3"],
      [2, "Item 2"],
      [1, "Item 1"],
    ] as const) {
      await user.keyboard("{Delete}");
      await flush();
      await new Promise((r) => setTimeout(r, 0));
      items = getAllByRole("row");
      expect(items).toHaveLength(left);
      expect(items[0]).toHaveTextContent(first);
    }
    await user.keyboard("{Delete}");
    await flush();
    await new Promise((r) => setTimeout(r, 0));
    expect(queryAllByRole("row")).toHaveLength(0);
    expect(document.activeElement).toBe(tagGroup);
  });

  it("should support onAction", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderTagGroup({ onAction: (k) => onAction(k), selectionMode: "none" });
    const items = getAllByRole("row");
    await user.click(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    onAction.mockReset();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should support onAction on the items", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderTagGroup({ selectionMode: "none" }, {}, { onAction: () => onAction() });
    const items = getAllByRole("row");
    await user.click(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    onAction.mockReset();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should support onAction with selectionMode = single, behaviour = replace", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderTagGroup({ onAction: (k) => onAction(k), selectionMode: "single", selectionBehavior: "replace" });
    const items = getAllByRole("row");
    await user.dblClick(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    onAction.mockReset();
    await user.click(items[1]!);
    expect(onAction).not.toHaveBeenCalled();
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    await user.dblClick(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "false");
    onAction.mockReset();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should support onAction with selectionMode = multiple, behaviour = replace", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderTagGroup({ onAction: (k) => onAction(k), selectionMode: "multiple", selectionBehavior: "replace" });
    const items = getAllByRole("row");
    await user.dblClick(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    onAction.mockReset();
    await user.click(items[1]!);
    expect(onAction).not.toHaveBeenCalled();
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    await user.dblClick(items[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(items[0]).toHaveAttribute("aria-selected", "true");
    expect(items[1]).toHaveAttribute("aria-selected", "false");
    onAction.mockReset();
    await user.keyboard("{Enter}");
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  describe("shouldSelectOnPressUp", () => {
    it.each([undefined, false] as const)("should select an item on pressing down when shouldSelectOnPressUp is %s", async (shouldSelectOnPressUp) => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderTagGroup({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k), shouldSelectOnPressUp });
      const items = getAllByRole("row");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it("should select an item on pressing up when shouldSelectOnPressUp is true", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderTagGroup({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k), shouldSelectOnPressUp: true });
      const items = getAllByRole("row");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(0);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("press events", () => {
    it.each(["mouse", "keyboard"] as const)("should support press events on items when using %s", async (interactionType) => {
      const onPressStart = vi.fn();
      const onPressEnd = vi.fn();
      const onPress = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = renderTagGroup({ selectionMode: "multiple" }, {}, {
        onPressStart: (e: unknown) => onPressStart(e),
        onPressEnd: (e: unknown) => onPressEnd(e),
        onPress: (e: unknown) => onPress(e),
        onClick: (e: unknown) => onClick(e),
      } as never);
      const tester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
      await tester.triggerRowAction({ row: 1, interactionType });
      expect(onPressStart).toHaveBeenCalledTimes(1);
      expect(onPressEnd).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });
});

// Port of react-aria test/tag/useTagGroup.test.js (on the RAC parts).
describe("useTagGroup", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });
  const Amenities = (p: Partial<TagGroupProps> & { keys?: [string, string][] }) => {
    const keys = p.keys ?? [
      ["laundry", "Laundry"],
      ["fitness", "Fitness center"],
      ["parking", "Parking"],
      ["pool", "Swimming pool"],
      ["breakfast", "Breakfast"],
    ];
    const { keys: _, ...groupProps } = p;
    return (
      <TagGroup aria-label="Amenities" {...groupProps}>
        <TagList>
          {keys.map(([id, label]) => (
            <RemovableTag id={id}>{label}</RemovableTag>
          ))}
        </TagList>
      </TagGroup>
    );
  };
  const three: [string, string][] = [
    ["laundry", "Laundry"],
    ["fitness", "Fitness center"],
    ["parking", "Parking"],
  ];

  it("should support selection", async () => {
    const onRemove = vi.fn();
    const { getAllByRole } = renderIt(() => <Amenities selectionMode="multiple" defaultSelectedKeys={["parking"]} onRemove={(k) => onRemove(k)} />);
    const tags = getAllByRole("row");
    expect(tags).toHaveLength(5);
    expect(tags.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "false", "false"]);
    await user.click(tags[3]!);
    expect(tags.map((t) => t.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "true", "false"]);
    await user.keyboard("{Backspace}");
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["parking", "pool"]));
    await user.click(tags[0]!);
    await user.keyboard("{Backspace}");
    expect(onRemove).toHaveBeenCalledTimes(2);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["laundry", "parking", "pool"]));
    await user.click(within(tags[3]!).getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(3);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["pool"]));
  });

  it("should support tabbing to tags and arrow navigation between tags", async () => {
    const { getAllByRole } = renderIt(() => <Amenities keys={three} />);
    const tags = getAllByRole("row");
    expect(document.activeElement).not.toBe(tags[0]);
    await user.tab();
    expect(document.activeElement).toBe(tags[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tags[1]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tags[2]);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(tags[1]);
  });

  it("should support tabbing to remove buttons", async () => {
    const onRemove = vi.fn();
    const { getAllByRole, getAllByText } = renderIt(() => <Amenities keys={three} onRemove={(k) => onRemove(k)} />);
    const tags = getAllByRole("row");
    const removeButtons = getAllByText("x");
    expect(removeButtons).toHaveLength(3);
    await user.tab();
    expect(document.activeElement).toBe(tags[0]);
    await user.tab();
    expect(document.activeElement).toBe(removeButtons[0]);
    await user.keyboard(" ");
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenLastCalledWith(new Set(["laundry"]));
  });

  it("should support keyboard selection while navigating between tags", async () => {
    const onSelectionChange = vi.fn();
    const { getAllByRole } = renderIt(() => <Amenities keys={three} selectionMode="multiple" onSelectionChange={(k) => onSelectionChange(k)} />);
    const tags = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(tags[0]);
    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(tags[1]);
    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(tags[0]).toHaveAttribute("aria-selected", "true");
    expect(tags[1]).toHaveAttribute("aria-selected", "true");
  });
});
