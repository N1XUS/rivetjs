// Ported from react-aria-components test/GridList.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries from `@testing-library/dom` `within(container)`;
// `className` → `class` (render props are accessors: `isHovered()`); `jest.fn` → `vi.fn`; `userEvent.setup()`
// (real PointerEvent, real timers); `React.createRef` → `ref()`; testers from `@rivetjs/testing/user`; default
// classes `rv-*`.
import { afterEach, beforeAll, describe, expect, it, vi, type Mock } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Checkbox as AriaCheckbox, CheckboxButton, CheckboxField } from "../checkbox/index.tsx";
import { Provider } from "../slots/index.tsx";
import { Collection } from "../collections/components.tsx";
import { Dialog, DialogTrigger } from "../dialog/index.tsx";
import { Modal } from "../modal/index.tsx";
import { Label } from "../label/index.tsx";
import { RouterProvider } from "../utils/links.tsx";
import { ListLayout, CollectionVirtualizer } from "../virtualizer/index.tsx";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import {
  GridList,
  GridListContext,
  GridListHeader,
  GridListItem,
  GridListLoadMoreItem,
  GridListSection,
  type GridListItemProps,
  type GridListProps,
} from "../grid-list/index.tsx";

afterEach(cleanup);

const Checkbox = (p: { comp?: string }) =>
  p.comp === "CheckboxField" ? (
    <CheckboxField slot="selection">
      <CheckboxButton />
    </CheckboxField>
  ) : (
    <AriaCheckbox slot="selection" />
  );

type TestItemProps = Partial<GridListItemProps> & { checkboxComponent?: string };

const TestGridList = (p: { listBoxProps?: Partial<GridListProps>; itemProps?: TestItemProps }) => {
  const listBoxProps = p.listBoxProps ?? {};
  const { checkboxComponent, ...itemProps } = p.itemProps ?? {};
  return (
    <GridList aria-label="Test" {...listBoxProps}>
      <GridListItem {...itemProps} id="cat" textValue="Cat">
        <Checkbox comp={checkboxComponent} /> Cat
      </GridListItem>
      <GridListItem {...itemProps} id="dog" textValue="Dog">
        <Checkbox comp={checkboxComponent} /> Dog
      </GridListItem>
      <GridListItem {...itemProps} id="kangaroo" textValue="Kangaroo">
        <Checkbox comp={checkboxComponent} /> Kangaroo
      </GridListItem>
    </GridList>
  );
};

const renderGridList = (listBoxProps?: Partial<GridListProps>, itemProps?: TestItemProps) => {
  const { container } = render(() => <TestGridList listBoxProps={listBoxProps} itemProps={itemProps} />);
  return within(container as HTMLElement);
};
const renderIt = (fn: () => unknown) => within(render(fn as never).container as HTMLElement);

describe("GridList", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)) });
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render with default classes", () => {
    const { getByRole } = renderGridList();
    const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
    expect(gridListTester.getGridlist()).toHaveAttribute("class", "rv-GridList");
    // Rivet: the navigation keys in `data-rk` (held by the resume loader while a cold chunk loads).
    expect(gridListTester.getGridlist()).toHaveAttribute("data-rk", "ArrowDown ArrowUp ArrowLeft ArrowRight Home End PageUp PageDown");
    for (const row of gridListTester.getRows()) expect(row).toHaveAttribute("class", "rv-GridListItem");
  });

  it("should render with custom classes", () => {
    const { getByRole, getAllByRole } = renderGridList({ class: "gridlist" }, { class: "item" });
    expect(getByRole("grid")).toHaveAttribute("class", "gridlist");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("class", "item");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderGridList({ "data-foo": "bar" }, { "data-bar": "foo" });
    expect(getByRole("grid")).toHaveAttribute("data-foo", "bar");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("data-bar", "foo");
  });

  it("should support slot", () => {
    const { getByRole } = renderIt(() => (
      <Provider values={[[GridListContext, { slots: { test: { "aria-label": "test" } } }]]}>
        <TestGridList listBoxProps={{ slot: "test", "aria-label": undefined }} />
      </Provider>
    ));
    const grid = getByRole("grid");
    expect(grid).toHaveAttribute("slot", "test");
    expect(grid).toHaveAttribute("aria-label", "test");
  });

  it("should support refs", async () => {
    const listBoxRef = ref<HTMLDivElement>();
    const itemRef = ref<HTMLDivElement>();
    renderIt(() => (
      <GridList aria-label="Test" ref={listBoxRef}>
        <GridListItem ref={itemRef}>Cat</GridListItem>
      </GridList>
    ));
    await flush();
    expect(listBoxRef()).toBeInstanceOf(HTMLElement);
    expect(itemRef()).toBeInstanceOf(HTMLElement);
  });

  // RAC custom render function: covered in the render-*.browser.test.tsx files.

  it("should support autoFocus", async () => {
    const { getByRole } = renderGridList({ autoFocus: true });
    await flush();
    expect(document.activeElement).toBe(getByRole("grid"));
  });

  describe('autoFocus with selectOnFocus (selectionBehavior="replace")', () => {
    it.each([
      { autoFocus: "first" as const, index: 0 },
      { autoFocus: "last" as const, index: 2 },
    ])("selects the autofocused row when selectOnFocus with autoFocus=$autoFocus", async ({ autoFocus, index }) => {
      const { getAllByRole } = renderGridList({ selectionMode: "single", selectionBehavior: "replace", autoFocus });
      await flush();
      const rows = getAllByRole("row");
      expect(document.activeElement).toBe(rows[index]);
      expect(rows[index]).toHaveAttribute("aria-selected", "true");
    });

    it('does not select the autofocused row when selectionMode="none"', async () => {
      const { getAllByRole } = renderGridList({ selectionMode: "none", selectionBehavior: "replace", autoFocus: "first" });
      await flush();
      const rows = getAllByRole("row");
      expect(document.activeElement).toBe(rows[0]);
      expect(rows[0]).not.toHaveAttribute("aria-selected");
    });

    it('does not change an existing "all" selection when autofocusing', async () => {
      const { getAllByRole } = renderGridList({ selectionMode: "multiple", selectionBehavior: "replace", defaultSelectedKeys: "all", autoFocus: "first" });
      await flush();
      const rows = getAllByRole("row");
      expect(document.activeElement).toBe(rows[0]);
      for (const row of rows) expect(row).toHaveAttribute("aria-selected", "true");
    });
  });

  it("should support hover", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderGridList(
      { selectionMode: "multiple" },
      { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd },
    );
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

  it.skip("should show hover state on draggable rows even when not selectable/actionable (drag and drop: C8)", () => {});

  it("should not show hover state when item is not interactive", async () => {
    const onHoverStart = vi.fn();
    const onHoverChange = vi.fn();
    const onHoverEnd = vi.fn();
    const { getAllByRole } = renderGridList({}, { class: ({ isHovered }) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd });
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("data-hovered");
    await user.hover(row);
    expect(row).not.toHaveAttribute("data-hovered");
    expect(row).not.toHaveClass("hover");
    expect(onHoverStart).not.toHaveBeenCalled();
    expect(onHoverChange).not.toHaveBeenCalled();
    expect(onHoverEnd).not.toHaveBeenCalled();
  });

  it("should support focus ring", async () => {
    const { getAllByRole } = renderGridList({ selectionMode: "multiple" }, { class: ({ isFocusVisible }) => (isFocusVisible() ? "focus" : "") });
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("data-focus-visible");
    expect(row).not.toHaveClass("focus");

    await user.tab();
    expect(document.activeElement).toBe(row);
    expect(row).toHaveAttribute("data-focus-visible", "true");
    expect(row).toHaveClass("focus");

    await user.tab();
    expect(row).not.toHaveAttribute("data-focus-visible");
    expect(row).not.toHaveClass("focus");
  });

  it("should support press state", async () => {
    const { getAllByRole } = renderGridList({ selectionMode: "multiple" }, { class: ({ isPressed }) => (isPressed() ? "pressed" : "") });
    const row = getAllByRole("row")[0]!;
    expect(row).not.toHaveAttribute("data-pressed");

    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).toHaveAttribute("data-pressed", "true");
    expect(row).toHaveClass("pressed");

    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
  });

  it("should not show press state when not interactive", async () => {
    const { getAllByRole } = renderGridList({}, { class: ({ isPressed }) => (isPressed() ? "pressed" : "") });
    const row = getAllByRole("row")[0]!;
    await user.pointer({ target: row, keys: "[MouseLeft>]" });
    expect(row).not.toHaveAttribute("data-pressed");
    expect(row).not.toHaveClass("pressed");
    await user.pointer({ target: row, keys: "[/MouseLeft]" });
    expect(row).not.toHaveAttribute("data-pressed");
  });

  it.each(["Checkbox", "CheckboxField"])("should support selection state with %s", async (comp) => {
    const { getByRole } = renderGridList(
      { selectionMode: "multiple" },
      { checkboxComponent: comp, class: ({ isSelected }) => (isSelected() ? "selected" : "") },
    );
    const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
    const row = gridListTester.getRows()[0]!;
    expect(row).not.toHaveAttribute("aria-selected", "true");
    expect(row).not.toHaveClass("selected");
    expect(within(row).getByRole("checkbox")).not.toBeChecked();

    await gridListTester.toggleRowSelection({ row: 0 });
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row).toHaveClass("selected");
    expect(within(row).getByRole("checkbox")).toBeChecked();

    await gridListTester.toggleRowSelection({ row: 0 });
    expect(row).not.toHaveAttribute("aria-selected", "true");
    expect(row).not.toHaveClass("selected");
    expect(within(row).getByRole("checkbox")).not.toBeChecked();
  });

  it('should prevent Esc from clearing selection if escapeKeyBehavior is "none"', async () => {
    const { getByRole } = renderGridList({ selectionMode: "multiple", escapeKeyBehavior: "none" });
    const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
    await gridListTester.toggleRowSelection({ row: 0 });
    expect(gridListTester.getSelectedRows()).toHaveLength(1);
    await gridListTester.toggleRowSelection({ row: 1 });
    expect(gridListTester.getSelectedRows()).toHaveLength(2);
    await user.keyboard("{Escape}");
    expect(gridListTester.getSelectedRows()).toHaveLength(2);
  });

  it("should support disabled state", async () => {
    const { getAllByRole, getByRole } = renderGridList(
      { selectionMode: "multiple", disabledKeys: ["cat"] },
      { class: ({ isDisabled }) => (isDisabled() ? "disabled" : "") },
    );
    const row = getAllByRole("row")[0]!;
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveClass("disabled");
    expect(within(row).getByRole("checkbox")).toBeDisabled();
    const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
    await expect(gridListTester.toggleRowSelection({ row: 0 })).rejects.toThrow();
    await expect(gridListTester.triggerRowAction({ row: 0 })).rejects.toThrow();
  });

  it("should support isDisabled prop on items", async () => {
    const { getByRole } = renderIt(() => (
      <GridList aria-label="Test">
        <GridListItem id="cat">Cat</GridListItem>
        <GridListItem id="dog" textValue="Dog" isDisabled>
          Dog <Button aria-label="Info">i</Button>
        </GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
    const rows = gridListTester.getRows();
    expect(rows[1]).toHaveAttribute("aria-disabled", "true");
    expect(within(rows[1]!).getByRole("button")).toBeDisabled();

    await user.tab();
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[2]);
  });

  it("should support onAction on items", async () => {
    const onAction = vi.fn();
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test">
        <GridListItem id="cat" onAction={() => onAction()}>
          Cat
        </GridListItem>
        <GridListItem id="dog">Dog</GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    await user.click(getAllByRole("row")[0]!);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("should support onAction on list and list items", async () => {
    const onAction = vi.fn();
    const itemAction = vi.fn();
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test" onAction={(key) => onAction(key)}>
        <GridListItem id="cat" onAction={() => itemAction()}>
          Cat
        </GridListItem>
        <GridListItem id="dog">Dog</GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    await user.click(getAllByRole("row")[0]!);
    expect(onAction).toHaveBeenCalledWith("cat");
    expect(itemAction).toHaveBeenCalledTimes(1);
  });

  it("should support empty state", () => {
    renderIt(() => (
      <GridList aria-label="Test" renderEmptyState={() => "No results"}>
        {[]}
      </GridList>
    ));
    const gridList = document.querySelector(".rv-GridList");
    expect(gridList).toHaveAttribute("data-empty", "true");
    expect(gridList).toHaveTextContent("No results");
  });

  it("should support dynamic collections", () => {
    const items = [
      { id: "cat", name: "Cat" },
      { id: "dog", name: "Dog" },
    ];
    const { getByRole } = renderIt(() => (
      <GridList aria-label="Test" items={items}>
        {(item: { id: string; name: string }) => <GridListItem id={item.id}>{item.name}</GridListItem>}
      </GridList>
    ));
    expect(
      within(getByRole("grid"))
        .getAllByRole("row")
        .map((r) => r.textContent),
    ).toEqual(["Cat", "Dog"]);
  });

  it("should support onScroll", () => {
    const onScroll = vi.fn();
    const { getByRole } = renderGridList({ onScroll: (e) => onScroll(e) });
    fireEvent.scroll(getByRole("grid"));
    expect(onScroll).toHaveBeenCalled();
  });

  it("should support grid layout", async () => {
    const buttonRef = ref<HTMLButtonElement>();
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test" layout="grid">
        <GridListItem id="cat">Cat</GridListItem>
        <GridListItem id="dog" textValue="Dog">
          Dog{" "}
          <Button aria-label="Info" ref={buttonRef}>
            i
          </Button>
        </GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    const items = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(items[1]);
    await user.tab();
    expect(document.activeElement).toBe(buttonRef());
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it("should support horizontal orientation", async () => {
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test" orientation="horizontal">
        <GridListItem id="cat">Cat</GridListItem>
        <GridListItem id="dog">Dog</GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    const items = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[0]);
  });

  it("should support horizontal orientation with grid layout", async () => {
    const buttonRef = ref<HTMLButtonElement>();
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test" orientation="horizontal" layout="grid">
        <GridListItem id="cat">Cat</GridListItem>
        <GridListItem id="dog" textValue="Dog">
          Dog{" "}
          <Button aria-label="Info" ref={buttonRef}>
            i
          </Button>
        </GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    const items = getAllByRole("row");
    await user.tab();
    expect(document.activeElement).toBe(items[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[2]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(items[1]);
    await user.tab();
    expect(document.activeElement).toBe(buttonRef());
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it('should support selectionMode="replace" with checkboxes', async () => {
    const { getAllByRole } = renderGridList({ selectionMode: "multiple", selectionBehavior: "replace" });
    const items = getAllByRole("row");
    await user.click(items[0]!);
    await user.click(items[1]!);
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    expect(items[2]).toHaveAttribute("aria-selected", "false");

    await user.click(within(items[2]!).getByRole("checkbox"));
    expect(items[0]).toHaveAttribute("aria-selected", "false");
    expect(items[1]).toHaveAttribute("aria-selected", "true");
    expect(items[2]).toHaveAttribute("aria-selected", "true");
  });

  it("should support sections", () => {
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test">
        <GridListSection>
          <GridListHeader>Favorite Animal</GridListHeader>
          <GridListItem id="cat" textValue="Cat">
            <Checkbox /> Cat
          </GridListItem>
          <GridListItem id="dog" textValue="Dog">
            <Checkbox /> Dog
          </GridListItem>
          <GridListItem id="kangaroo" textValue="Kangaroo">
            <Checkbox /> Kangaroo
          </GridListItem>
        </GridListSection>
        <GridListSection aria-label="Favorite Ice Cream">
          <GridListItem id="vanilla" textValue="Vanilla">
            <Checkbox />
            Vanilla
          </GridListItem>
          <GridListItem id="chocolate" textValue="Chocolate">
            <Checkbox />
            Chocolate
          </GridListItem>
          <GridListItem id="strawberry" textValue="Strawberry">
            <Checkbox />
            Strawberry
          </GridListItem>
        </GridListSection>
      </GridList>
    ));
    const groups = getAllByRole("rowgroup");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveClass("rv-GridListSection");
    expect(groups[1]).toHaveClass("rv-GridListSection");
    expect(groups[0]).toHaveAttribute("aria-labelledby");
    expect(document.getElementById(groups[0]!.getAttribute("aria-labelledby")!)).toHaveTextContent("Favorite Animal");
    expect(groups[1]!.getAttribute("aria-label")).toEqual("Favorite Ice Cream");
  });

  // Rivet: `rerender` → signal-driven `Collection items` per section.
  it("should update collection when moving item to a different section", async () => {
    type Food = { id: string; name: string };
    const veggies = signal<Food[]>([
      { id: "lettuce", name: "Lettuce" },
      { id: "tomato", name: "Tomato" },
      { id: "onion", name: "Onion" },
    ]);
    const meats = signal<Food[]>([
      { id: "ham", name: "Ham" },
      { id: "tuna", name: "Tuna" },
      { id: "tofu", name: "Tofu" },
    ]);
    const { getAllByRole } = renderIt(() => (
      <GridList aria-label="Test">
        <GridListSection id="veggies">
          <GridListHeader>Veggies</GridListHeader>
          <Collection items={veggies}>{(item: Food) => <GridListItem id={item.id}>{item.name}</GridListItem>}</Collection>
        </GridListSection>
        <GridListSection id="meats">
          <GridListHeader>Meats</GridListHeader>
          <Collection items={meats}>{(item: Food) => <GridListItem id={item.id}>{item.name}</GridListItem>}</Collection>
        </GridListSection>
      </GridList>
    ));
    let sections = getAllByRole("rowgroup");
    expect(within(sections[0]!).getAllByRole("gridcell")).toHaveLength(3);
    expect(within(sections[1]!).getAllByRole("gridcell")).toHaveLength(3);

    veggies.set([...veggies(), { id: "ham", name: "Ham" }]);
    meats.set(meats().slice(1));
    await flush();
    sections = getAllByRole("rowgroup");
    expect(within(sections[0]!).getAllByRole("gridcell")).toHaveLength(4);
    expect(within(sections[1]!).getAllByRole("gridcell")).toHaveLength(2);
  });

  describe('selectionBehavior="replace"', () => {
    const GridListNoCheckboxes = (p: { listBoxProps: Partial<GridListProps> }) => (
      <GridList aria-label="Test" {...p.listBoxProps}>
        <GridListItem id="cat" textValue="Cat">
          Cat
        </GridListItem>
        <GridListItem id="dog" textValue="Dog">
          Dog
        </GridListItem>
        <GridListItem id="kangaroo" textValue="Kangaroo">
          Kangaroo
        </GridListItem>
      </GridList>
    );
    const lastKeys = (fn: ReturnType<typeof vi.fn>) => new Set(fn.mock.calls.at(-1)![0] as Iterable<string>);

    describe.each(["mouse", "keyboard", "touch"] as const)("%s", (type) => {
      it("should perform selection with single selection", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderIt(() => (
          <GridListNoCheckboxes
            listBoxProps={{ selectionMode: "single", selectionBehavior: "replace", onSelectionChange: (keys) => onSelectionChange(keys) }}
          />
        ));
        const gridListTester = testUtilUser.createTester("GridList", { user, root: getByRole("grid"), interactionType: type });
        const rows = gridListTester.getRows();
        for (const row of rows) {
          expect(within(row).queryByRole("checkbox")).toBeNull();
          expect(row).toHaveAttribute("aria-selected", "false");
          expect(row).not.toHaveAttribute("data-selected");
          expect(row).toHaveAttribute("data-selection-mode", "single");
        }
        const row2 = rows[2]!;
        expect(onSelectionChange).toHaveBeenCalledTimes(0);
        await gridListTester.toggleRowSelection({ row: "Kangaroo", selectionBehavior: "replace" });
        expect(row2).toHaveAttribute("aria-selected", "true");
        expect(row2).toHaveAttribute("data-selected", "true");
        // keyboard: initial focus selects the first keyboard focused row
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 2 : 1);
        expect(lastKeys(onSelectionChange)).toEqual(new Set(["kangaroo"]));
        expect(gridListTester.getSelectedRows()).toHaveLength(1);
        expect(gridListTester.getSelectedRows()[0]).toBe(row2);

        const row1 = rows[1]!;
        await gridListTester.toggleRowSelection({ row: row1, selectionBehavior: "replace" });
        expect(row1).toHaveAttribute("aria-selected", "true");
        expect(row1).toHaveAttribute("data-selected", "true");
        expect(row2).toHaveAttribute("aria-selected", "false");
        expect(row2).not.toHaveAttribute("data-selected");
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 3 : 2);
        expect(lastKeys(onSelectionChange)).toEqual(new Set(["dog"]));
        expect(gridListTester.getSelectedRows()).toHaveLength(1);
        expect(gridListTester.getSelectedRows()[0]).toBe(row1);

        await gridListTester.toggleRowSelection({ row: row1, selectionBehavior: "replace" });
        expect(row1).toHaveAttribute("aria-selected", "false");
        expect(row1).not.toHaveAttribute("data-selected");
        expect(row2).toHaveAttribute("aria-selected", "false");
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 3);
        expect(lastKeys(onSelectionChange)).toEqual(new Set([]));
        expect(gridListTester.getSelectedRows()).toHaveLength(0);
      });

      it("should perform toggle selection in highlight mode when using modifier keys", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderIt(() => (
          <GridListNoCheckboxes
            listBoxProps={{ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: (keys) => onSelectionChange(keys) }}
          />
        ));
        const gridListTester = testUtilUser.createTester("GridList", { user, root: getByRole("grid"), interactionType: type });
        const rows = gridListTester.getRows();
        for (const row of rows) {
          expect(within(row).queryByRole("checkbox")).toBeNull();
          expect(row).toHaveAttribute("aria-selected", "false");
          expect(row).toHaveAttribute("data-selection-mode", "multiple");
        }
        const row2 = rows[2]!;
        await gridListTester.toggleRowSelection({ row: "Kangaroo", selectionBehavior: "replace" });
        expect(row2).toHaveAttribute("aria-selected", "true");
        expect(row2).toHaveAttribute("data-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["cat", "kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(2);
          expect(gridListTester.getSelectedRows()[1]).toBe(row2);
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(1);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(1);
          expect(gridListTester.getSelectedRows()[0]).toBe(row2);
        }

        const row1 = rows[1]!;
        await gridListTester.toggleRowSelection({ row: row1, selectionBehavior: "replace" });
        expect(row1).toHaveAttribute("aria-selected", "true");
        expect(row2).toHaveAttribute("aria-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["cat", "dog", "kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(3);
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["dog", "kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(2);
          expect(gridListTester.getSelectedRows()[0]).toBe(row1);
          expect(gridListTester.getSelectedRows()[1]).toBe(row2);
        }

        // With modifier key, you should be able to deselect on press of the same row
        await gridListTester.toggleRowSelection({ row: row1, selectionBehavior: "replace" });
        expect(row1).toHaveAttribute("aria-selected", "false");
        expect(row1).not.toHaveAttribute("data-selected");
        expect(row2).toHaveAttribute("aria-selected", "true");
        if (type === "keyboard") {
          expect(onSelectionChange).toHaveBeenCalledTimes(4);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["cat", "kangaroo"]));
        } else {
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(1);
          expect(gridListTester.getSelectedRows()[0]).toBe(row2);
        }
      });

      it("should perform replace selection in highlight mode when not using modifier keys", async () => {
        const onSelectionChange = vi.fn();
        const { getByRole } = renderIt(() => (
          <GridListNoCheckboxes
            listBoxProps={{ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: (keys) => onSelectionChange(keys) }}
          />
        ));
        const gridListTester = testUtilUser.createTester("GridList", { user, root: getByRole("grid"), interactionType: type });
        const rows = gridListTester.getRows();
        const row2 = rows[2]!;
        await gridListTester.toggleRowSelection({ row: "Kangaroo" });
        expect(row2).toHaveAttribute("aria-selected", "true");
        expect(row2).toHaveAttribute("data-selected", "true");
        // keyboard: selection follows focus while arrowing down to the target row
        expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 3 : 1);
        expect(lastKeys(onSelectionChange)).toEqual(new Set(["kangaroo"]));
        expect(gridListTester.getSelectedRows()).toHaveLength(1);
        expect(gridListTester.getSelectedRows()[0]).toBe(row2);

        const row1 = rows[1]!;
        await gridListTester.toggleRowSelection({ row: row1 });
        if (type !== "touch") {
          expect(row1).toHaveAttribute("aria-selected", "true");
          expect(row2).toHaveAttribute("aria-selected", "false");
          expect(row2).not.toHaveAttribute("data-selected");
          expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 2);
          expect(lastKeys(onSelectionChange)).toEqual(new Set(["dog"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(1);
          expect(gridListTester.getSelectedRows()[0]).toBe(row1);

          // pressing without modifier keys won't deselect the row
          await gridListTester.toggleRowSelection({ row: row1 });
          expect(row1).toHaveAttribute("aria-selected", "true");
          expect(onSelectionChange).toHaveBeenCalledTimes(type === "keyboard" ? 4 : 2);
          expect(gridListTester.getSelectedRows()).toHaveLength(1);
        } else {
          // touch always behaves as toggle
          expect(row1).toHaveAttribute("aria-selected", "true");
          expect(row2).toHaveAttribute("aria-selected", "true");
          expect(onSelectionChange).toHaveBeenCalledTimes(2);
          expect(new Set(onSelectionChange.mock.calls[1]![0] as Iterable<string>)).toEqual(new Set(["dog", "kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(2);
          expect(gridListTester.getSelectedRows()[0]).toBe(row1);

          await gridListTester.toggleRowSelection({ row: row1 });
          expect(row1).toHaveAttribute("aria-selected", "false");
          expect(onSelectionChange).toHaveBeenCalledTimes(3);
          expect(new Set(onSelectionChange.mock.calls[2]![0] as Iterable<string>)).toEqual(new Set(["kangaroo"]));
          expect(gridListTester.getSelectedRows()).toHaveLength(1);
          expect(gridListTester.getSelectedRows()[0]).toBe(row2);
        }
      });
    });
  });

  // "should support virtualizer": ported below ("GridList virtualizer").

  it("should not propagate the checkbox context from selection into other cells", async () => {
    const { getByRole } = renderIt(() => (
      <GridList aria-label="Test" selectionMode="multiple">
        <GridListItem id="dialog" textValue="dialog">
          <DialogTrigger>
            <Button>Open</Button>
            <Modal>
              <Dialog>
                <AriaCheckbox>
                  <Label>Agree</Label>
                </AriaCheckbox>
              </Dialog>
            </Modal>
          </DialogTrigger>
        </GridListItem>
        <GridListItem id="dog" textValue="Dog">
          Dog
        </GridListItem>
        <GridListItem id="kangaroo">Kangaroo</GridListItem>
      </GridList>
    ));
    await user.click(getByRole("button"));
    await flush();
    expect(within(document.body).getByRole("checkbox")).toBeInTheDocument();
  });

  it("should support nested collections with colliding keys", () => {
    const { container } = render(() => (
      <GridList aria-label="CardView" keyboardNavigationBehavior="tab">
        <GridListItem id="1" textValue="Card">
          <GridList aria-label="Previews">
            <GridListItem id="1">Paco de Lucia</GridListItem>
          </GridList>
        </GridListItem>
      </GridList>
    ));
    const itemMap = new Map<string, Element>();
    for (const item of (container as HTMLElement).querySelectorAll("[data-key]")) {
      if (item instanceof HTMLElement) {
        const key = item.dataset.collection + ":" + item.dataset.key;
        expect(itemMap.has(key)).toBe(false);
        itemMap.set(key, item);
      }
    }
  });

  describe("drag and drop", () => {
    it.skip("should support drag button slot (C8)", () => {});
    it.skip("should render drop indicators (C8)", () => {});
    it.skip("should not skip drop positions before/after a disabled item (C8)", () => {});
    it.skip("should support dropping on rows (C8)", () => {});
    it.skip("should support dropping on the root (C8)", () => {});
    it.skip("should support dropping with horizontal arrow keys when orientation is horizontal (C8)", () => {});
  });

  describe("links", () => {
    describe.each(["mouse", "keyboard"] as const)("%s", (type) => {
      const trigger = async (item: HTMLElement, key = "Enter") => {
        if (type === "mouse") await user.click(item);
        else {
          fireEvent.keyDown(item, { key });
          fireEvent.keyUp(item, { key });
        }
      };
      // mockClickDefault: a window click listener that records + prevents the navigation.
      let onClick: Mock<(e: Event) => void>;
      const mockClickDefault = () => {
        onClick = vi.fn((e: Event) => e.preventDefault());
        window.addEventListener("click", onClick);
        return onClick;
      };
      afterEach(() => window.removeEventListener("click", onClick));
      const target = (call: unknown[]) => (call[0] as Event).target as HTMLAnchorElement;

      it('should support links with selectionMode="none"', async () => {
        const { getAllByRole } = renderIt(() => (
          <GridList aria-label="listview">
            <GridListItem href="https://google.com">One</GridListItem>
            <GridListItem href="https://adobe.com">Two</GridListItem>
          </GridList>
        ));
        const items = getAllByRole("row");
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault();
        if (type === "keyboard") await user.tab();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!)).toBeInstanceOf(HTMLAnchorElement);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionBehavior="toggle" selectionMode="%s"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => (
          <GridList aria-label="listview" selectionMode={selectionMode}>
            <GridListItem href="https://google.com" textValue="one">
              <Checkbox /> One
            </GridListItem>
            <GridListItem href="https://adobe.com" textValue="two">
              <Checkbox /> Two
            </GridListItem>
          </GridList>
        ));
        const items = getAllByRole("row");
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault();
        if (type === "keyboard") await user.tab();
        await trigger(items[0]!);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");

        await user.click(within(items[0]!).getByRole("checkbox"));
        expect(items[0]).toHaveAttribute("aria-selected", "true");

        if (type === "keyboard") await user.keyboard("{ArrowDown}");
        await trigger(items[1]!, " ");
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(items[1]).toHaveAttribute("aria-selected", "true");
      });

      it.each(["single", "multiple"] as const)('should support links with selectionBehavior="replace" selectionMode="%s"', async (selectionMode) => {
        const { getAllByRole } = renderIt(() => (
          <GridList aria-label="listview" selectionMode={selectionMode} selectionBehavior="replace">
            <GridListItem href="https://google.com">One</GridListItem>
            <GridListItem href="https://adobe.com">Two</GridListItem>
          </GridList>
        ));
        const items = getAllByRole("row");
        for (const item of items) {
          expect(item.tagName).not.toBe("A");
          expect(item).toHaveAttribute("data-href");
        }
        const onClick = mockClickDefault();
        if (type === "mouse") await user.click(items[0]!);
        else {
          await user.tab();
          await user.keyboard(" ");
          // single selection with replace will follow focus
          if (selectionMode === "single") await user.keyboard(" ");
        }
        expect(onClick).not.toHaveBeenCalled();
        expect(items[0]).toHaveAttribute("aria-selected", "true");

        if (type === "mouse") await user.dblClick(items[0]!);
        else await user.keyboard("{Enter}");
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(target(onClick.mock.calls[0]!)).toBeInstanceOf(HTMLAnchorElement);
        expect(target(onClick.mock.calls[0]!).href).toBe("https://google.com/");
      });

      it("should work with RouterProvider", async () => {
        const navigate = vi.fn();
        const { getAllByRole } = renderIt(() => (
          <RouterProvider navigate={(path, options) => navigate(path, options)} useHref={(href) => "/base" + href}>
            <GridList aria-label="listview">
              <GridListItem href="/foo" routerOptions={{ foo: "bar" } as never}>
                One
              </GridListItem>
            </GridList>
          </RouterProvider>
        ));
        const items = getAllByRole("row");
        expect(items[0]).toHaveAttribute("data-href", "/base/foo");
        if (type === "keyboard") await user.tab();
        await trigger(items[0]!);
        expect(navigate).toHaveBeenCalledWith("/foo", { foo: "bar" });
      });
    });
  });

  describe("shouldSelectOnPressUp", () => {
    it("should select an item on pressing down when shouldSelectOnPressUp is not provided", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderGridList({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k) });
      const items = getAllByRole("row");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it("should select an item on pressing down when shouldSelectOnPressUp is false", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderGridList({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k), shouldSelectOnPressUp: false });
      const items = getAllByRole("row");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it("should select an item on pressing up when shouldSelectOnPressUp is true", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderGridList({ selectionMode: "single", onSelectionChange: (k) => onSelectionChange(k), shouldSelectOnPressUp: true });
      const items = getAllByRole("row");
      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(0);
      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("async loading", () => {
    type Named = { name: string };
    const items: Named[] = [{ name: "Foo" }, { name: "Bar" }, { name: "Baz" }];
    // Rivet: `rerender` → signals.
    const AsyncGridList = (p: { items: () => Named[]; isLoading?: () => boolean; onLoadMore?: () => void }) => {
      const { items, isLoading, onLoadMore } = p;
      return (
        <GridList aria-label="async gridlist" renderEmptyState={() => <div>empty state</div>}>
          <Collection items={items}>{(item: Named) => <GridListItem id={item.name}>{item.name}</GridListItem>}</Collection>
          <GridListLoadMoreItem isLoading={isLoading} onLoadMore={onLoadMore ? () => onLoadMore() : undefined}>
            Loading...
          </GridListLoadMoreItem>
        </GridList>
      );
    };

    it("should render the loading element when loading", () => {
      const tree = renderIt(() => <AsyncGridList isLoading={() => true} items={() => items} />);
      const gridListTester = testUtilUser.createTester("GridList", { root: tree.getByRole("grid") });
      const rows = gridListTester.getRows();
      expect(rows).toHaveLength(4);
      expect(rows[3]).toHaveTextContent("Loading...");
      expect(tree.getByTestId("loadMoreSentinel").parentElement).toHaveAttribute("inert");
    });

    it("should render the sentinel but not the loading indicator when not loading", () => {
      const tree = renderIt(() => <AsyncGridList items={() => items} />);
      const gridListTester = testUtilUser.createTester("GridList", { root: tree.getByRole("grid") });
      expect(gridListTester.getRows()).toHaveLength(3);
      expect(tree.queryByText("Loading...")).toBeFalsy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
    });

    it("should properly render the renderEmptyState if gridlist is empty", async () => {
      const isLoading = signal(false);
      const tree = renderIt(() => <AsyncGridList items={() => []} isLoading={isLoading} />);
      const gridListTester = testUtilUser.createTester("GridList", { root: tree.getByRole("grid") });
      let rows = gridListTester.getRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent("empty state");
      expect(tree.queryByText("Loading...")).toBeFalsy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();

      // Even if the gridlist is empty, providing isLoading will render the loader
      isLoading.set(true);
      await flush();
      rows = gridListTester.getRows();
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveTextContent("empty state");
      expect(tree.queryByText("Loading...")).toBeTruthy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
    });

    it("should only fire loadMore when intersection is detected regardless of loading state", async () => {
      // setupIntersectionObserverMock: one instance, callback triggered by hand.
      const observe = vi.fn();
      let callback: IntersectionObserverCallback | undefined;
      const Original = window.IntersectionObserver;
      window.IntersectionObserver = class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe = observe;
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;
      try {
        const onLoadMore = vi.fn();
        const isLoading = signal(true);
        const tree = renderIt(() => <AsyncGridList items={() => items} onLoadMore={() => onLoadMore()} isLoading={isLoading} />);
        await flush();
        const sentinel = tree.getByTestId("loadMoreSentinel");
        expect(observe).toHaveBeenLastCalledWith(sentinel);
        expect(onLoadMore).toHaveBeenCalledTimes(0);

        callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        observe.mockClear();

        isLoading.set(false);
        await flush();
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        callback!([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
        expect(onLoadMore).toHaveBeenCalledTimes(2);
      } finally {
        window.IntersectionObserver = Original;
      }
    });

    describe("virtualized", () => {
      it.skip("should always render the sentinel even when virtualized (GridListLoadMoreItem inside CollectionVirtualizer not covered yet)", () => {});
      it.skip("should not reserve room for the loader if isLoading is false (GridListLoadMoreItem inside CollectionVirtualizer not covered yet)", () => {});
      it.skip("should have the correct row indicies after loading more items (GridListLoadMoreItem inside CollectionVirtualizer not covered yet)", () => {});
    });
  });

  describe("press events", () => {
    it.each(["mouse", "keyboard"] as const)("should support press events on items when using %s", async (interactionType) => {
      const onAction = vi.fn();
      const onPressStart = vi.fn();
      const onPressEnd = vi.fn();
      const onPress = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = renderGridList(
        {},
        {
          onAction: () => onAction(),
          onPressStart: (e) => onPressStart(e),
          onPressEnd: (e) => onPressEnd(e),
          onPress: (e) => onPress(e),
          onClick: (e) => onClick(e),
        },
      );
      const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("grid") });
      await gridListTester.triggerRowAction({ row: 1, interactionType });
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onPressStart).toHaveBeenCalledTimes(1);
      expect(onPressEnd).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("tab navigation and textfields", () => {
    const modes = [
      ['keyboardNavigationBehavior="tab"', { keyboardNavigationBehavior: "tab" as const }],
      ['layout="grid"', { layout: "grid" as const }],
    ] as const;
    const InputList = (p: { listProps: Partial<GridListProps> }) => (
      <GridList aria-label="Test" {...p.listProps}>
        <GridListItem id="item1" textValue="Apple">
          Apple <input aria-label="input 1" />
        </GridListItem>
        <GridListItem id="item2" textValue="Banana">
          Banana
        </GridListItem>
      </GridList>
    );

    it.each(modes)("should not navigate rows when arrow keys are pressed while a text input child has focus (%s)", async (_, listProps) => {
      const { getByRole } = renderIt(() => <InputList listProps={listProps} />);
      const rows = testUtilUser.createTester("GridList", { root: getByRole("grid") }).getRows();
      const input = getByRole("textbox");
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      expect(document.activeElement).toBe(input);
      for (const key of ["{ArrowDown}", "{ArrowUp}", "{ArrowRight}", "{ArrowLeft}"]) {
        await user.keyboard(key);
        expect(document.activeElement).toBe(input);
      }
    });

    it.each(modes)("should not trigger typeahead when typing in a text input child (%s)", async (_, listProps) => {
      const { getByRole } = renderIt(() => <InputList listProps={listProps} />);
      const rows = testUtilUser.createTester("GridList", { root: getByRole("grid") }).getRows();
      const input = getByRole("textbox");
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      expect(document.activeElement).toBe(input);
      await user.keyboard("b");
      expect(document.activeElement).toBe(input);
      expect(input).toHaveValue("b");
    });

    it.each(modes)("should not trigger selection when pressing Space or Enter in a text input child (%s)", async (_, listProps) => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => (
        <InputList listProps={{ ...listProps, selectionMode: "multiple", onSelectionChange: (k) => onSelectionChange(k) }} />
      ));
      const rows = testUtilUser.createTester("GridList", { root: getByRole("grid") }).getRows();
      const input = getByRole("textbox");
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      expect(document.activeElement).toBe(input);
      await user.keyboard(" ");
      expect(input).toHaveValue(" ");
      expect(onSelectionChange).not.toHaveBeenCalled();
      await user.keyboard("{Enter}");
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("should not trigger selection when clicking on a tabbable child in arrow navigation mode", async () => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => <InputList listProps={{ selectionMode: "multiple", onSelectionChange: (k) => onSelectionChange(k) }} />);
      const input = getByRole("textbox");
      await user.click(input);
      expect(document.activeElement).toBe(input);
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it.each(modes)("should not trigger selection when clicking on a tabbable child element (%s)", async (_, listProps) => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => (
        <InputList listProps={{ ...listProps, selectionMode: "multiple", onSelectionChange: (k) => onSelectionChange(k) }} />
      ));
      const input = getByRole("textbox");
      await user.click(input);
      expect(document.activeElement).toBe(input);
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it.each(modes)("should still trigger selection when clicking on a row with no tabbable children (%s)", async (_, listProps) => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => (
        <GridList aria-label="Test" {...listProps} selectionMode="multiple" onSelectionChange={(k) => onSelectionChange(k)}>
          <GridListItem id="item1" textValue="Apple">
            Apple
          </GridListItem>
          <GridListItem id="item2" textValue="Banana">
            Banana
          </GridListItem>
        </GridList>
      ));
      const rows = testUtilUser.createTester("GridList", { root: getByRole("grid") }).getRows();
      await user.click(rows[0]!);
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(new Set(onSelectionChange.mock.calls[0]![0] as Iterable<string>)).toEqual(new Set(["item1"]));
    });

    // TODO(C2b ComboBox, Toolbar RAC parts): needs RAC ComboBox / Toolbar / ListBox parts.
    it.skip("should exit the grid when tabbing from a combobox or toolbar, not focus the next row", () => {});
  });

  describe("focusMode and allowsArrowNavigation", () => {
    const ChildButtons = (p: { listProps?: Partial<GridListProps>; itemProps?: Partial<GridListItemProps>; count?: number; withInput?: boolean }) => {
      const ids = [1, 2, 3].slice(0, p.count ?? 3);
      const itemProps = p.itemProps ?? {};
      const withInput = p.withInput;
      return (
        <GridList aria-label="List" {...(p.listProps ?? {})}>
          {ids.map((i) => (
            <GridListItem id={String(i)} textValue={"Item " + i} focusMode="child" {...itemProps}>
              <button tabIndex={0} aria-label={"Item " + i + " action"}>
                Go
              </button>
              {withInput ? <input /> : null}
            </GridListItem>
          ))}
        </GridList>
      );
    };

    it('focusMode="child" auto-focuses first child when item receives focus', async () => {
      const { getByRole } = renderIt(() => <ChildButtons listProps={{ keyboardNavigationBehavior: "tab" }} />);
      await user.tab();
      await new Promise((r) => requestAnimationFrame(r));
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      await user.tab({ shift: true });
      await user.keyboard("{ArrowDown}");
      await new Promise((r) => requestAnimationFrame(r));
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
    });

    it("allowsArrowNavigation allows arrow key row navigation when focused on child", async () => {
      const { getByRole } = renderIt(() => <ChildButtons listProps={{ keyboardNavigationBehavior: "tab" }} itemProps={{ allowsArrowNavigation: true }} />);
      await user.tab();
      await new Promise((r) => requestAnimationFrame(r));
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      await user.keyboard("{ArrowDown}");
      await new Promise((r) => requestAnimationFrame(r));
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
    });

    describe('focusMode="child" with default arrow navigation', () => {
      it("ArrowDown from child navigates to first child of next item", async () => {
        const { getByRole } = renderIt(() => <ChildButtons withInput />);
        await user.tab();
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.keyboard("{ArrowDown}");
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
        await user.keyboard("{ArrowDown}");
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 3 action" }));
      });

      it("ArrowUp from child navigates to first child of previous item", async () => {
        const { getByRole } = renderIt(() => <ChildButtons withInput count={2} />);
        await user.tab();
        await new Promise((r) => requestAnimationFrame(r));
        await user.keyboard("{ArrowDown}");
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
        await user.keyboard("{ArrowUp}");
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      });

      const TwoButtons = () => (
        <GridList aria-label="List">
          <GridListItem id="1" textValue="Item 1" focusMode="child">
            <button tabIndex={0} aria-label="Item 1 first">
              First
            </button>
            <button tabIndex={0} aria-label="Item 1 last">
              Last
            </button>
          </GridListItem>
        </GridList>
      );

      it("ArrowLeft/Right cycles through children and row element", async () => {
        const { getByRole, getAllByRole } = renderIt(() => <TwoButtons />);
        const rows = getAllByRole("row");
        const firstBtn = getByRole("button", { name: "Item 1 first" });
        const lastBtn = getByRole("button", { name: "Item 1 last" });
        await user.tab();
        await new Promise((r) => requestAnimationFrame(r));
        expect(document.activeElement).toBe(firstBtn);
        // ArrowRight: first → last → row (wraps)
        await user.keyboard("{ArrowRight}");
        expect(document.activeElement).toBe(lastBtn);
        await user.keyboard("{ArrowRight}");
        expect(document.activeElement).toBe(rows[0]);
        // ArrowLeft from row wraps to last; from last goes to first; from first goes to row
        await user.keyboard("{ArrowLeft}");
        expect(document.activeElement).toBe(lastBtn);
        await user.keyboard("{ArrowLeft}");
        expect(document.activeElement).toBe(firstBtn);
        await user.keyboard("{ArrowLeft}");
        expect(document.activeElement).toBe(rows[0]);
        // ArrowRight from row enters first child
        await user.keyboard("{ArrowRight}");
        expect(document.activeElement).toBe(firstBtn);
      });

      describe("RTL", () => {
        it("ArrowLeft/Right RTL cycle: ArrowLeft advances forward, ArrowRight wraps to last child", async () => {
          const { getByRole, getAllByRole } = renderIt(() => (
            <I18nProvider locale="ar-AE">
              <TwoButtons />
            </I18nProvider>
          ));
          const rows = getAllByRole("row");
          const firstBtn = getByRole("button", { name: "Item 1 first" });
          const lastBtn = getByRole("button", { name: "Item 1 last" });
          await user.tab();
          await new Promise((r) => requestAnimationFrame(r));
          expect(document.activeElement).toBe(firstBtn);
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(lastBtn);
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(rows[0]);
          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(lastBtn);
        });
      });
    });

    describe('focusMode="row" (default) with tab navigation', () => {
      it("Tab into list focuses row, Tab from row enters child, Shift+Tab returns to row", async () => {
        const { getByRole, getAllByRole } = renderIt(() => (
          <GridList aria-label="List" keyboardNavigationBehavior="tab">
            <GridListItem id="1" textValue="Item 1">
              <button tabIndex={0} aria-label="Item 1 action">
                Go
              </button>
              <button tabIndex={0} aria-label="Item 1 action 2">
                Go 2
              </button>
            </GridListItem>
          </GridList>
        ));
        const rows = getAllByRole("row");
        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        await user.tab();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.tab();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action 2" }));
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(rows[0]);
      });
    });
  });
});

// RAC GridList.test.js "should support virtualizer": real sizes (a 100 x 100 scroller and `initialSize`) instead of
// mocked clientWidth / clientHeight; Rivet also checks aria-rowindex / aria-rowcount, focus and scroll-into-view.
describe("GridList virtualizer", () => {
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const texts = (els: HTMLElement[]) => els.map((o) => o.textContent);
  const settle = async (scroller: HTMLElement) => {
    for (let last = -1; last !== scroller.scrollTop;) {
      last = scroller.scrollTop;
      await frame();
      await frame();
    }
  };
  const inView = (scroller: HTMLElement, el: Element | null) => {
    const box = scroller.getBoundingClientRect();
    const rect = el!.getBoundingClientRect();
    return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
  };
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i, name: "Item " + i }));
  const firstWindow = ["Item 0", "Item 1", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6"];
  const scrolledWindow = ["Item 7", "Item 8", "Item 9", "Item 10", "Item 11", "Item 12", "Item 13", "Item 14"];

  it("should support virtualizer", async () => {
    const user = userEvent.setup();
    const { getByRole } = renderIt(() => (
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 25 }} initialSize={{ width: 100, height: 100 }}>
        <GridList aria-label="Test" items={items} selectionMode="single" style={{ display: "block", width: "100px", height: "100px", overflow: "auto" }}>
          {(item: { id: number; name: string }) => <GridListItem textValue={item.name}>{item.name}</GridListItem>}
        </GridList>
      </CollectionVirtualizer>
    ));
    const grid = getByRole("grid");
    expect(grid).toHaveAttribute("aria-rowcount", "50");
    expect(grid).toHaveAttribute("aria-colcount", "1");
    let rows = within(grid).getAllByRole("row");
    expect(texts(rows)).toEqual(firstWindow);
    expect(rows[0]).toHaveAttribute("aria-rowindex", "1");
    grid.scrollTop = 200;
    fireEvent.scroll(grid);
    await frame();
    rows = within(grid).getAllByRole("row");
    expect(texts(rows)).toEqual(scrolledWindow);
    expect(rows[0]).toHaveAttribute("aria-rowindex", "8");
    await new Promise((resolve) => setTimeout(resolve, 350));
    await user.click(rows[1]!);
    expect(rows[1]).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(rows[1]);
    await user.keyboard("{End}");
    await settle(grid);
    expect(document.activeElement?.textContent).toBe("Item 49");
    expect(inView(grid, document.activeElement)).toBe(true);
    // The focused row stays rendered next to the window.
    expect(texts(within(grid).getAllByRole("row"))).toContain("Item 49");
    await user.keyboard("{Home}");
    await settle(grid);
    expect(document.activeElement?.textContent).toBe("Item 0");
    expect(grid.scrollTop).toBe(0);
    await user.keyboard("{PageDown}");
    await settle(grid);
    expect(document.activeElement?.textContent).toBe("Item 3");
  });
});
