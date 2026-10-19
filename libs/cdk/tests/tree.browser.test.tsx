// Ported from react-aria-components test/Tree.test.tsx + test/AriaTree.test-util.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isExpanded()`); `jest.fn` → `vi.fn`; real timers
// (`jest.runAllTimers()` for typeahead → wait 1100ms); `rerender(<X …/>)` → `cleanup()` + `render` (or a signal
// for the controlled prop); `mockClickDefault` → a window click listener that prevents the navigation; testers from
// `@rivetjs/testing/user`; default classes `rv-*`; icon glyph buttons (⏷ ⏵ ⓘ ☰) → text labels; the stories
// (`EmptyTreeStaticStory`, `LoadingStoryDepOnTopStory`, `TreeWithTextFieldStory`) are inlined, their MenuTrigger /
// ComboBox cells replaced by Buttons / native inputs (same tab stops, none of the ported tests open them).
// Skipped (reasons inline): RAC Virtualizer cases beyond "should support virtualizer" (sections, loaders);
// drag and drop (DnD lane); `data-rac` assertions (Rivet renders no `data-rac`).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { fireEvent, within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { User } from "@rivetjs/testing/user";
import { Button } from "../button/index.tsx";
import { Checkbox, CheckboxButton, CheckboxField } from "../checkbox/index.tsx";
import { Collection } from "../collections/components.tsx";
import { Text } from "../text/index.tsx";
import { TextField } from "../text-field/index.tsx";
import { Input } from "../input/index.tsx";
import { ListLayout, CollectionVirtualizer } from "../virtualizer/index.tsx";
import { Toolbar } from "../toolbar/index.tsx";
import { Tree, TreeHeader, TreeItem, TreeItemContent, TreeLoadMoreItem, TreeSection } from "../tree/index.tsx";

const renderIt = (fn: () => unknown) => {
  const result = render(fn as never);
  return Object.assign(within(result.container as HTMLElement), { container: result.container as HTMLElement });
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** react-aria moves focus to the first child of a focusMode="child" row after a frame (jest fake timers upstream). */
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

let clickListeners: ((e: Event) => void)[] = [];
/** react-spectrum `mockClickDefault`: records clicks on window and prevents their default (link navigation). */
function mockClickDefault() {
  const onClick = vi.fn((e: Event) => e.preventDefault());
  window.addEventListener("click", onClick);
  clickListeners.push(onClick);
  return onClick;
}

afterEach(() => {
  cleanup();
  for (const listener of clickListeners) window.removeEventListener("click", listener);
  clickListeners = [];
});

const onSelectionChange = vi.fn();
const onAction = vi.fn();
const onExpandedChange = vi.fn();

const StaticTreeItem = (props: any) => {
  return (
    <TreeItem {...props}>
      <TreeItemContent>
        {({ isExpanded, hasChildItems, selectionMode, selectionBehavior }: any) => (
          <>
            {(selectionMode() !== "none" || props.href != null) && selectionBehavior() === "toggle" ? (
              props.checkboxComponent === "CheckboxField" ? (
                <CheckboxField slot="selection">
                  <CheckboxButton />
                </CheckboxField>
              ) : (
                <Checkbox slot="selection" />
              )
            ) : null}
            {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
            <Text>{props.title || props.children}</Text>
            <Button aria-label="Info">Info</Button>
            <Button aria-label="Menu">Menu</Button>
          </>
        )}
      </TreeItemContent>
      {props.title && props.children}
    </TreeItem>
  );
};

const StaticTree = (p: { treeProps?: any; rowProps?: any }) => {
  const treeProps = p.treeProps ?? {},
    rowProps = p.rowProps ?? {};
  return (
    <Tree
      defaultExpandedKeys={new Set(["projects", "projects-1"])}
      disabledBehavior="selection"
      aria-label="test tree"
      onExpandedChange={onExpandedChange}
      onSelectionChange={onSelectionChange}
      {...treeProps}
    >
      <StaticTreeItem id="Photos" textValue="Photos" {...rowProps}>
        Photos
      </StaticTreeItem>
      <StaticTreeItem id="projects" textValue="Projects" title="Projects" {...rowProps}>
        <StaticTreeItem id="projects-1" textValue="Projects-1" title="Projects-1" {...rowProps}>
          <StaticTreeItem id="projects-1A" textValue="Projects-1A" {...rowProps}>
            Projects-1A
          </StaticTreeItem>
        </StaticTreeItem>
        <StaticTreeItem id="projects-2" textValue="Projects-2" {...rowProps}>
          Projects-2
        </StaticTreeItem>
        <StaticTreeItem id="projects-3" textValue="Projects-3" {...rowProps}>
          Projects-3
        </StaticTreeItem>
      </StaticTreeItem>
    </Tree>
  );
};

const StaticSectionTree = (p: { treeProps?: any; rowProps?: any }) => {
  const treeProps = p.treeProps ?? {},
    rowProps = p.rowProps ?? {};
  return (
    <Tree
      defaultExpandedKeys={new Set(["projects", "projects-1"])}
      disabledBehavior="selection"
      aria-label="test tree"
      onExpandedChange={onExpandedChange}
      onSelectionChange={onSelectionChange}
      {...treeProps}
    >
      <TreeSection aria-label="Section 1">
        <StaticTreeItem id="Photos" textValue="Photos" {...rowProps}>
          Photos
        </StaticTreeItem>
      </TreeSection>
      <TreeSection>
        <TreeHeader>Section 2</TreeHeader>
        <StaticTreeItem id="projects" textValue="Projects" title="Projects" {...rowProps}>
          <StaticTreeItem id="projects-1" textValue="Projects-1" title="Projects-1" {...rowProps}>
            <StaticTreeItem id="projects-1A" textValue="Projects-1A" {...rowProps}>
              Projects-1A
            </StaticTreeItem>
          </StaticTreeItem>
          <StaticTreeItem id="projects-2" textValue="Projects-2" {...rowProps}>
            Projects-2
          </StaticTreeItem>
          <StaticTreeItem id="projects-3" textValue="Projects-3" {...rowProps}>
            Projects-3
          </StaticTreeItem>
        </StaticTreeItem>
      </TreeSection>
    </Tree>
  );
};

const rows = [
  {
    id: "projects",
    name: "Projects",
    childItems: [
      { id: "project-1", name: "Project 1" },
      {
        id: "project-2",
        name: "Project 2",
        childItems: [
          { id: "project-2A", name: "Project 2A" },
          { id: "project-2B", name: "Project 2B" },
          { id: "project-2C", name: "Project 2C" },
        ],
      },
      { id: "project-3", name: "Project 3" },
      { id: "project-4", name: "Project 4" },
      {
        id: "project-5",
        name: "Project 5",
        childItems: [
          { id: "project-5A", name: "Project 5A" },
          { id: "project-5B", name: "Project 5B" },
          { id: "project-5C", name: "Project 5C" },
        ],
      },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    childItems: [
      {
        id: "reports-1",
        name: "Reports 1",
        childItems: [
          {
            id: "reports-1A",
            name: "Reports 1A",
            childItems: [{ id: "reports-1AB", name: "Reports 1AB", childItems: [{ id: "reports-1ABC", name: "Reports 1ABC" }] }],
          },
          { id: "reports-1B", name: "Reports 1B" },
          { id: "reports-1C", name: "Reports 1C" },
        ],
      },
      { id: "reports-2", name: "Reports 2" },
    ],
  },
];

const rowsWithSections = [
  { id: "section_1", name: "Section 1", childItems: [rows[0]] },
  { id: "section_2", name: "Section 2", childItems: [rows[1]] },
];

const DynamicTreeItem = (props: any) => {
  return (
    <TreeItem {...props}>
      <TreeItemContent>
        {({ isExpanded, hasChildItems, selectionMode, selectionBehavior }: any) => (
          <>
            {(selectionMode() !== "none" || props.href != null) && selectionBehavior() === "toggle" ? <Checkbox slot="selection" /> : null}
            {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
            <Text>{props.title || props.children}</Text>
            <Button aria-label="Info">Info</Button>
            <Button aria-label="Menu">Menu</Button>
          </>
        )}
      </TreeItemContent>
      <Collection items={props.childItems}>
        {(item: any) => (
          <DynamicTreeItem childItems={item.childItems} textValue={item.name} href={props.href}>
            {item.name}
          </DynamicTreeItem>
        )}
      </Collection>
    </TreeItem>
  );
};

const defaultExpanded = () => new Set(["projects", "project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]);

const DynamicTree = (p: { treeProps?: any; rowProps?: any }) => {
  const treeProps = p.treeProps ?? {},
    rowProps = p.rowProps ?? {};
  return (
    <Tree
      defaultExpandedKeys={defaultExpanded()}
      aria-label="test dynamic tree"
      items={rows}
      onExpandedChange={onExpandedChange}
      onSelectionChange={onSelectionChange}
      {...treeProps}
    >
      {(item: any) => (
        <DynamicTreeItem childItems={item.childItems} textValue={item.name} {...rowProps}>
          {item.name}
        </DynamicTreeItem>
      )}
    </Tree>
  );
};

const DynamicSectionTree = (p: { treeProps?: any; rowProps?: any }) => {
  const treeProps = p.treeProps ?? {},
    rowProps = p.rowProps ?? {};
  return (
    <Tree
      defaultExpandedKeys={defaultExpanded()}
      aria-label="test dynamic tree"
      items={rowsWithSections}
      onExpandedChange={onExpandedChange}
      onSelectionChange={onSelectionChange}
      {...treeProps}
    >
      <Collection items={rowsWithSections}>
        {(section: any) => (
          <TreeSection>
            <TreeHeader>{section.name}</TreeHeader>
            <Collection items={section.childItems}>
              {(item: any) => (
                <DynamicTreeItem id={item.id} childItems={item.childItems} textValue={item.name} {...rowProps}>
                  {item.name}
                </DynamicTreeItem>
              )}
            </Collection>
          </TreeSection>
        )}
      </Collection>
    </Tree>
  );
};

// --- stories (react-aria-components stories/Tree.stories.tsx) ----------------------------------

const MyTreeLoader = (props: any) => (
  <TreeLoadMoreItem class="tree-loader" {...props}>
    {({ level }: any) => <span>{level() === 1 ? "Load more spinner" : `Level ${level()} loading spinner`}</span>}
  </TreeLoadMoreItem>
);

const StoryTreeItem = (props: any) => (
  <>
    <TreeItem {...props}>
      <TreeItemContent>
        {({ isExpanded, hasChildItems }: any) => (
          <>
            {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
            <Text>{props.children}</Text>
            <Button aria-label="Info">Info</Button>
          </>
        )}
      </TreeItemContent>
      <Collection items={props.childItems}>
        {(item: any) => (
          <StoryTreeItem renderLoader={props.renderLoader} isLoading={props.isLoading} id={item.id} childItems={item.childItems} textValue={item.name}>
            {item.name}
          </StoryTreeItem>
        )}
      </Collection>
      {props.renderLoader?.(props.id) ? <MyTreeLoader isLoading={props.isLoading} onLoadMore={props.onLoadMore} /> : null}
    </TreeItem>
    {props.isLastInRoot ? <MyTreeLoader isLoading={props.isLoading} onLoadMore={props.onLoadMore} /> : null}
  </>
);

/** LoadingStoryDepOnTopStory. */
const LoadingMoreTree = (props: { isLoading?: boolean }) => (
  <Tree items={rows} defaultExpandedKeys={defaultExpanded()} disabledKeys={["reports-1AB"]} aria-label="test dynamic tree">
    {(item: any) => (
      <StoryTreeItem
        isLastInRoot={item.id === "reports"}
        renderLoader={(id: unknown) => id === "root" || id === "project-2"}
        isLoading={props.isLoading}
        id={item.id}
        childItems={item.childItems ?? []}
        textValue={item.name}
      >
        {item.name}
      </StoryTreeItem>
    )}
  </Tree>
);

/** EmptyTreeStaticStory. */
const EmptyLoadingTree = (props: { isLoading?: boolean }) => (
  <Tree aria-label="test empty static tree" renderEmptyState={() => (props.isLoading ? "Root level loading spinner" : "Nothing in tree")}>
    <Collection items={[]}>
      {(item: any) => (
        <StoryTreeItem id={item.id} childItems={item.childItems} textValue={item.name}>
          {item.name}
        </StoryTreeItem>
      )}
    </Collection>
  </Tree>
);

// Rivet: `interactive` is a render function — a JSX prop is evaluated when the item component runs, which is the
// collection build pass (`isHiddenPart()`), so hideable parts (Input, …) would render nothing there.
const TextFieldTreeItem = (props: any) => (
  <TreeItem {...props}>
    <TreeItemContent>
      {({ isExpanded, hasChildItems, selectionMode, selectionBehavior }: any) => (
        <>
          {selectionMode() !== "none" && selectionBehavior() === "toggle" ? <Checkbox slot="selection" /> : null}
          {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
          <Text>{props.title || props.children}</Text>
          {props.interactive?.()}
          <Button aria-label="Info">Info</Button>
          <Button aria-label="Menu">Menu</Button>
        </>
      )}
    </TreeItemContent>
    {props.title && props.children}
  </TreeItem>
);

/** TreeWithTextFieldStory (args: selectionMode none, selectionBehavior toggle, disabledBehavior selection). */
const TreeWithTextFieldStory = (props: any) => (
  <div style={{ display: "flex", "flex-direction": "column" }}>
    <input aria-label="Before tree" />
    <Tree
      style={{ width: "400px" }}
      aria-label="tree with textfields"
      disabledKeys={["rawinput"]}
      keyboardNavigationBehavior="tab"
      selectionMode="none"
      selectionBehavior="toggle"
      disabledBehavior="selection"
      {...props}
    >
      <TextFieldTreeItem
        id="textfield"
        textValue="RAC TextField"
        interactive={() => (
          <TextField aria-label="Name">
            <Input />
          </TextField>
        )}
      >
        RAC TextField
      </TextFieldTreeItem>
      <TextFieldTreeItem id="rawinput" textValue="Raw input" interactive={() => <input aria-label="Raw text input" />}>
        Raw input
      </TextFieldTreeItem>
      <TextFieldTreeItem
        id="row1"
        textValue="row 1"
        title="row 1"
        interactive={() => (
          <TextField aria-label="row 1 input">
            <Input />
          </TextField>
        )}
      >
        <TextFieldTreeItem
          id="group1-textfield-button"
          textValue="TextField and Button"
          interactive={() => (
            <>
              <TextField aria-label="Search">
                <Input />
              </TextField>
              <Button>Go</Button>
            </>
          )}
        >
          TextField + Button
        </TextFieldTreeItem>
        <TextFieldTreeItem
          id="group1-toolbar"
          textValue="Toolbar"
          interactive={() => (
            <Toolbar aria-label="Text formatting">
              <Button>Bold</Button>
              <Button>Italic</Button>
              <Button>Underline</Button>
            </Toolbar>
          )}
        >
          Toolbar
        </TextFieldTreeItem>
      </TextFieldTreeItem>
    </Tree>
    <input aria-label="After tree" />
  </div>
);

describe("Tree", () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testUtilUser = new User({ advanceTimer: (ms: number) => wait(ms) });

  beforeAll(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render a Tree with default classes", () => {
    const { getByRole, getAllByRole } = renderIt(() => <StaticTree />);
    const tree = getByRole("treegrid");
    expect(tree).toHaveAttribute("class", "rv-Tree");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("class", "rv-TreeItem");
  });

  it("should render a Tree with custom classes", () => {
    const { getByRole, getAllByRole } = renderIt(() => <StaticTree treeProps={{ class: "test-tree" }} rowProps={{ class: "test-row" }} />);
    expect(getByRole("treegrid")).toHaveAttribute("class", "test-tree");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("class", "test-row");
  });

  it("should support DOM props", () => {
    const { getByRole, getAllByRole } = renderIt(() => <StaticTree treeProps={{ "data-testid": "test-tree" }} rowProps={{ "data-testid": "test-row" }} />);
    expect(getByRole("treegrid")).toHaveAttribute("data-testid", "test-tree");
    for (const row of getAllByRole("row")) expect(row).toHaveAttribute("data-testid", "test-row");
  });

  // RAC custom render function: covered in render-leftovers.

  it("should support style", () => {
    const { getByRole } = renderIt(() => <StaticTree treeProps={{ style: { width: "200px" } }} />);
    expect(getByRole("treegrid")).toHaveAttribute("style", expect.stringContaining("width: 200px"));
  });

  it("should have the base set of data attributes", () => {
    const { getByRole, getAllByRole } = renderIt(() => <StaticTree treeProps={{ defaultExpandedKeys: [] }} />);
    const tree = getByRole("treegrid");
    expect(tree).not.toHaveAttribute("data-empty");
    expect(tree).not.toHaveAttribute("data-focused");
    expect(tree).not.toHaveAttribute("data-focus-visible");

    for (const row of getAllByRole("row")) {
      expect(row).not.toHaveAttribute("data-selected");
      expect(row).not.toHaveAttribute("data-disabled");
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveAttribute("data-focused");
      expect(row).not.toHaveAttribute("data-focus-visible");
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveAttribute("data-selection-mode");
    }
  });

  it("should have the expected attributes on the rows", () => {
    const { getAllByRole } = renderIt(() => <StaticTree />);
    const rows = getAllByRole("row");
    const rowNoChild = rows[0]!;
    expect(rowNoChild).toHaveAttribute("aria-label", "Photos");
    expect(rowNoChild).not.toHaveAttribute("aria-expanded");
    expect(rowNoChild).not.toHaveAttribute("data-expanded");
    expect(rowNoChild).toHaveAttribute("data-level", "1");
    expect(rowNoChild).not.toHaveAttribute("data-has-child-items");

    const rowWithChildren = rows[1]!;
    // Row has action since it is expandable but not selectable.
    expect(rowWithChildren).toHaveAttribute("aria-label", "Projects");
    expect(rowWithChildren).toHaveAttribute("data-expanded", "true");
    expect(rowWithChildren).toHaveAttribute("data-level", "1");
    expect(rowWithChildren).toHaveAttribute("data-has-child-items", "true");

    const level2ChildRow = rows[2]!;
    expect(level2ChildRow).toHaveAttribute("aria-label", "Projects-1");
    expect(level2ChildRow).toHaveAttribute("data-expanded", "true");
    expect(level2ChildRow).toHaveAttribute("data-level", "2");
    expect(level2ChildRow).toHaveAttribute("data-has-child-items", "true");

    const level3ChildRow = rows[3]!;
    expect(level3ChildRow).toHaveAttribute("aria-label", "Projects-1A");
    expect(level3ChildRow).not.toHaveAttribute("data-expanded");
    expect(level3ChildRow).toHaveAttribute("data-level", "3");
    expect(level3ChildRow).not.toHaveAttribute("data-has-child-items");

    const level2ChildRow2 = rows[4]!;
    expect(level2ChildRow2).toHaveAttribute("aria-label", "Projects-2");
    expect(level2ChildRow2).not.toHaveAttribute("data-expanded");
    expect(level2ChildRow2).toHaveAttribute("data-level", "2");
    expect(level2ChildRow2).not.toHaveAttribute("data-has-child-items");

    const level2ChildRow3 = rows[5]!;
    expect(level2ChildRow3).toHaveAttribute("aria-label", "Projects-3");
    expect(level2ChildRow3).not.toHaveAttribute("data-expanded");
    expect(level2ChildRow3).toHaveAttribute("data-level", "2");
    expect(level2ChildRow3).not.toHaveAttribute("data-has-child-items");
  });

  it("should include the row as part of the expand/collapse button accessible label", () => {
    const { getAllByRole } = renderIt(() => <StaticTree />);
    for (const row of getAllByRole("row")) {
      if (row.hasAttribute("data-has-child-items")) {
        const expandButton = within(row).getAllByRole("button")[0]!;
        expect(expandButton).toHaveAttribute("aria-labelledby", `${expandButton.id} ${row.id}`);
      }
    }
  });

  it("should not label an expandable row as having an action if it supports selection", () => {
    const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "single" }} />);
    expect(getAllByRole("row")[1]).toHaveAttribute("data-has-child-items", "true");
  });

  it("should support dynamic trees", () => {
    const { getByRole, getAllByRole } = renderIt(() => <DynamicTree />);
    expect(getByRole("treegrid")).toHaveAttribute("class", "rv-Tree");

    const rows = getAllByRole("row");
    expect(rows).toHaveLength(20);

    expect(rows[0]).toHaveAttribute("aria-label", "Projects");
    expect(rows[0]).toHaveAttribute("aria-expanded", "true");
    expect(rows[0]).toHaveAttribute("aria-level", "1");
    expect(rows[0]).toHaveAttribute("aria-posinset", "1");
    expect(rows[0]).toHaveAttribute("aria-setsize", "2");
    expect(rows[0]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[2]).toHaveAttribute("aria-label", "Project 2");
    expect(rows[2]).toHaveAttribute("aria-expanded", "true");
    expect(rows[2]).toHaveAttribute("aria-level", "2");
    expect(rows[2]).toHaveAttribute("aria-posinset", "2");
    expect(rows[2]).toHaveAttribute("aria-setsize", "5");
    expect(rows[2]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[8]).toHaveAttribute("aria-label", "Project 5");
    expect(rows[8]).toHaveAttribute("aria-expanded", "true");
    expect(rows[8]).toHaveAttribute("aria-level", "2");
    expect(rows[8]).toHaveAttribute("aria-posinset", "5");
    expect(rows[8]).toHaveAttribute("aria-setsize", "5");
    expect(rows[8]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[12]).toHaveAttribute("aria-label", "Reports");
    expect(rows[12]).toHaveAttribute("aria-expanded", "true");
    expect(rows[12]).toHaveAttribute("aria-level", "1");
    expect(rows[12]).toHaveAttribute("aria-posinset", "2");
    expect(rows[12]).toHaveAttribute("aria-setsize", "2");
    expect(rows[12]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[16]).toHaveAttribute("aria-label", "Reports 1ABC");
    expect(rows[16]).toHaveAttribute("aria-level", "5");
    expect(rows[16]).toHaveAttribute("aria-posinset", "1");
    expect(rows[16]).toHaveAttribute("aria-setsize", "1");
  });

  it("should support items with falsy keys", async () => {
    const falsyKeyRows = [
      {
        id: 0,
        name: "Zero",
        childItems: [
          { id: "", name: "Empty" },
          { id: "zero-child", name: "Zero child" },
        ],
      },
      { id: 1, name: "One" },
    ];

    const { getAllByRole } = renderIt(() => (
      <Tree defaultExpandedKeys={new Set([0])} aria-label="falsy keys tree" items={falsyKeyRows}>
        {(item: any) => (
          <DynamicTreeItem childItems={item.childItems} textValue={item.name}>
            {item.name}
          </DynamicTreeItem>
        )}
      </Tree>
    ));

    const rows = getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("Zero");
    expect(rows[1]).toHaveTextContent("Empty");
    expect(rows[2]).toHaveTextContent("Zero child");
    expect(rows[3]).toHaveTextContent("One");

    await user.tab();
    expect(document.activeElement).toBe(rows[0]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[2]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows[3]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(rows[2]);
  });

  it.each(["Checkbox", "CheckboxField"])("should render checkboxes for selection using %s", async (comp) => {
    const { getByRole, getAllByRole } = renderIt(() => (
      <StaticTree treeProps={{ selectionMode: "single" }} rowProps={{ href: "https://google.com", checkboxComponent: comp }} />
    ));
    expect(getByRole("treegrid")).not.toHaveAttribute("aria-multiselectable");

    for (const row of getAllByRole("row")) {
      const checkbox = within(row).getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
      expect(checkbox).toHaveAttribute("aria-label", "Select");
      expect(checkbox).toHaveAttribute("aria-labelledby", `${checkbox.id} ${row.id}`);
      expect(row).toHaveAttribute("aria-selected", "false");
      expect(row).not.toHaveAttribute("data-selected");
      expect(row).toHaveAttribute("data-selection-mode", "single");
    }

    const row = getAllByRole("row")[2]!;
    const checkbox = within(row).getByRole("checkbox");
    await user.click(checkbox);
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row).toHaveAttribute("data-selected", "true");
    expect(checkbox).toBeChecked();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(new Set(onSelectionChange.mock.calls[0]![0])).toEqual(new Set(["projects-1"]));
  });

  it("should allow unslotted checkboxes in item content", () => {
    const { getByRole } = renderIt(() => (
      <Tree aria-label="test tree">
        <TreeItem id="item" textValue="Item">
          <TreeItemContent>
            <Text>Item</Text>
            <Checkbox>Flag item</Checkbox>
          </TreeItemContent>
        </TreeItem>
      </Tree>
    ));
    expect(getByRole("checkbox", { name: "Flag item" })).toBeInTheDocument();
  });

  it("should not render checkboxes for selection with selectionBehavior=replace ", async () => {
    const { getByRole, getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "multiple", selectionBehavior: "replace" }} />);
    expect(getByRole("treegrid")).toHaveAttribute("aria-multiselectable", "true");

    for (const row of getAllByRole("row")) {
      expect(within(row).queryByRole("checkbox")).toBeNull();
      expect(row).toHaveAttribute("aria-selected", "false");
      expect(row).not.toHaveAttribute("data-selected");
      expect(row).toHaveAttribute("data-selection-mode", "multiple");
    }

    const row2 = getAllByRole("row")[2]!;
    await user.click(row2);
    expect(row2).toHaveAttribute("aria-selected", "true");
    expect(row2).toHaveAttribute("data-selected", "true");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(new Set(onSelectionChange.mock.calls[0]![0])).toEqual(new Set(["projects-1"]));

    const row1 = getAllByRole("row")[1]!;
    await user.click(row1);
    expect(row1).toHaveAttribute("aria-selected", "true");
    expect(row1).toHaveAttribute("data-selected", "true");
    expect(row2).toHaveAttribute("aria-selected", "false");
    expect(row2).not.toHaveAttribute("data-selected");
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(new Set(onSelectionChange.mock.calls[1]![0])).toEqual(new Set(["projects"]));
  });

  // "should support virtualizer": ported below ("Tree virtualizer").

  describe("general interactions", () => {
    it("should support hover on rows", async () => {
      const onHoverStart = vi.fn();
      const onHoverChange = vi.fn();
      const onHoverEnd = vi.fn();
      let { getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "multiple" }}
          rowProps={{ class: ({ isHovered }: any) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd }}
        />
      ));

      let row = getAllByRole("row")[0]!;
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

      cleanup();
      ({ getAllByRole } = renderIt(() => (
        <StaticTree treeProps={{ selectionMode: "none", onAction: vi.fn() }} rowProps={{ class: ({ isHovered }: any) => (isHovered() ? "hover" : "") }} />
      )));
      row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveClass("hover");

      await user.hover(row);
      expect(row).toHaveAttribute("data-hovered", "true");
      expect(row).toHaveClass("hover");

      await user.unhover(row);
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveClass("hover");
    });

    it.skip("should show hover state on draggable rows even when not selectable/actionable (drag and drop: DnD lane)", () => {});

    it("should not update the hover state if the row is not interactive", async () => {
      const onHoverStart = vi.fn();
      const onHoverChange = vi.fn();
      const onHoverEnd = vi.fn();
      let { getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "none" }}
          rowProps={{ class: ({ isHovered }: any) => (isHovered() ? "hover" : ""), onHoverStart, onHoverChange, onHoverEnd }}
        />
      ));

      const row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveClass("hover");
      expect(onHoverStart).toHaveBeenCalledTimes(0);
      expect(onHoverChange).toHaveBeenCalledTimes(0);
      expect(onHoverEnd).toHaveBeenCalledTimes(0);

      await user.hover(row);
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveClass("hover");
      expect(onHoverStart).toHaveBeenCalledTimes(0);
      expect(onHoverChange).toHaveBeenCalledTimes(0);
      expect(onHoverEnd).toHaveBeenCalledTimes(0);

      let expandableRow = getAllByRole("row")[1]!;
      expect(expandableRow).not.toHaveAttribute("data-hovered");
      expect(expandableRow).not.toHaveClass("hover");

      await user.hover(expandableRow);
      expect(expandableRow).toHaveAttribute("data-hovered", "true");
      expect(expandableRow).toHaveClass("hover");
      expect(onHoverStart).toHaveBeenCalledTimes(1);
      expect(onHoverChange).toHaveBeenCalledTimes(1);
      expect(onHoverEnd).toHaveBeenCalledTimes(0);

      await user.unhover(expandableRow);
      expect(expandableRow).not.toHaveAttribute("data-hovered");
      expect(expandableRow).not.toHaveClass("hover");
      expect(onHoverEnd).toHaveBeenCalledTimes(1);
      expect(onHoverChange).toHaveBeenCalledTimes(2);

      // Test a completely inert expandable row
      // Note the disabledBehavior setting here, by default we make disableKey keys NOT restrict expandablity of the row. Similar pattern to Table
      const inertOnHoverStart = vi.fn();
      const inertOnHoverChange = vi.fn();
      const inertOnHoverEnd = vi.fn();
      cleanup();
      ({ getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "none", disabledBehavior: "all", disabledKeys: ["projects"] }}
          rowProps={{
            class: ({ isHovered }: any) => (isHovered() ? "hover" : ""),
            onHoverStart: inertOnHoverStart,
            onHoverChange: inertOnHoverChange,
            onHoverEnd: inertOnHoverEnd,
          }}
        />
      )));

      expandableRow = getAllByRole("row")[1]!;
      expect(expandableRow).toHaveAttribute("data-disabled", "true");
      expect(expandableRow).not.toHaveAttribute("data-hovered");
      expect(expandableRow).not.toHaveClass("hover");

      await user.hover(expandableRow);
      expect(expandableRow).not.toHaveAttribute("data-hovered");
      expect(expandableRow).not.toHaveClass("hover");
      expect(inertOnHoverStart).toHaveBeenCalledTimes(0);
      expect(inertOnHoverChange).toHaveBeenCalledTimes(0);
      expect(inertOnHoverEnd).toHaveBeenCalledTimes(0);
    });

    it("should support press on rows", async () => {
      let { getAllByRole } = renderIt(() => (
        <StaticTree treeProps={{ selectionMode: "multiple" }} rowProps={{ class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") }} />
      ));

      let row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");

      await user.pointer({ target: row, keys: "[MouseLeft>]" });
      expect(row).toHaveAttribute("data-pressed", "true");
      expect(row).toHaveClass("pressed");

      await user.pointer({ target: row, keys: "[/MouseLeft]" });
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");

      cleanup();
      ({ getAllByRole } = renderIt(() => (
        <StaticTree treeProps={{ selectionMode: "none", onAction: vi.fn() }} rowProps={{ class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") }} />
      )));
      row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");

      await user.pointer({ target: row, keys: "[MouseLeft>]" });
      expect(row).toHaveAttribute("data-pressed", "true");
      expect(row).toHaveClass("pressed");

      await user.pointer({ target: row, keys: "[/MouseLeft]" });
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");
    });

    it("should not update the press state if the row is not interactive", async () => {
      let { getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "none", disabledBehavior: "selection" }}
          rowProps={{ class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") }}
        />
      ));

      const row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");

      await user.pointer({ target: row, keys: "[MouseLeft>]" });
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveClass("pressed");
      await user.pointer({ target: row, keys: "[/MouseLeft]" });

      let expandableRow = getAllByRole("row")[1]!;
      expect(expandableRow).not.toHaveAttribute("data-pressed");
      expect(expandableRow).not.toHaveClass("pressed");

      await user.pointer({ target: expandableRow, keys: "[MouseLeft>]" });
      expect(expandableRow).toHaveAttribute("data-pressed", "true");
      expect(expandableRow).toHaveClass("pressed");

      await user.pointer({ target: expandableRow, keys: "[/MouseLeft]" });
      expect(expandableRow).not.toHaveAttribute("data-pressed");
      expect(expandableRow).not.toHaveClass("pressed");

      // Test a completely inert expandable row
      cleanup();
      ({ getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "none", disabledBehavior: "all", disabledKeys: ["projects"] }}
          rowProps={{ class: ({ isPressed }: any) => (isPressed() ? "pressed" : "") }}
        />
      )));
      expandableRow = getAllByRole("row")[1]!;
      expect(expandableRow).toHaveAttribute("data-disabled", "true");
      expect(expandableRow).not.toHaveAttribute("data-pressed");
      expect(expandableRow).not.toHaveClass("pressed");

      await user.pointer({ target: expandableRow, keys: "[MouseLeft>]" });
      expect(expandableRow).not.toHaveAttribute("data-pressed");
      expect(expandableRow).not.toHaveClass("pressed");
      await user.pointer({ target: expandableRow, keys: "[/MouseLeft]" });
    });

    it("should support focus", async () => {
      let { getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "multiple", disabledKeys: ["projects"], disabledBehavior: "selection" }}
          rowProps={{ class: ({ isFocused }: any) => (isFocused() ? "focus" : "") }}
        />
      ));

      let row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-focused");
      expect(row).not.toHaveClass("focus");

      await user.click(row);
      expect(row).toHaveAttribute("data-focused");
      expect(row).toHaveClass("focus");

      cleanup();
      ({ getAllByRole } = renderIt(() => (
        <StaticTree
          treeProps={{ selectionMode: "multiple", disabledKeys: ["projects"], disabledBehavior: "selection" }}
          rowProps={{ class: ({ isFocusVisible }: any) => (isFocusVisible() ? "focus-visible" : "") }}
        />
      )));
      row = getAllByRole("row")[0]!;
      expect(row).not.toHaveAttribute("data-focus-visible");
      expect(row).not.toHaveClass("focus-visible");

      await user.click(row);
      expect(row).not.toHaveAttribute("data-focus-visible");
      expect(row).not.toHaveClass("focus-visible");

      await user.keyboard("{Enter}");
      expect(row).toHaveAttribute("data-focus-visible", "true");
      expect(row).toHaveClass("focus-visible");

      let disabledRow = getAllByRole("row")[1]!;
      expect(disabledRow).not.toHaveAttribute("data-disabled", "true");
      expect(disabledRow).not.toHaveAttribute("data-focus-visible");
      expect(disabledRow).not.toHaveClass("focus-visible");

      await user.keyboard("{ArrowDown}");
      disabledRow = getAllByRole("row")[1]!;
      // Note that the row is able to be focused because default disabledBehavior is 'selection'
      expect(disabledRow).toHaveAttribute("data-focus-visible", "true");
      expect(disabledRow).toHaveClass("focus-visible");
      expect(row).not.toHaveAttribute("data-focus-visible");
      expect(row).not.toHaveClass("focus-visible");
    });

    it("should support actions on rows", async () => {
      const { getAllByRole } = renderIt(() => (
        <StaticTree treeProps={{ selectionMode: "multiple", disabledBehavior: "all", onAction, disabledKeys: ["projects"] }} />
      ));

      const row = getAllByRole("row")[0]!;
      await user.click(row);
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onAction).toHaveBeenLastCalledWith("Photos");
      expect(onSelectionChange).toHaveBeenCalledTimes(0);

      // Due to disabledBehavior being set to 'all' this expandable row has its action disabled
      const disabledRow = getAllByRole("row")[1]!;
      expect(disabledRow).toHaveAttribute("data-disabled", "true");
      await user.click(disabledRow);
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onSelectionChange).toHaveBeenCalledTimes(0);

      const expandableRow = getAllByRole("row")[2]!;
      await user.click(expandableRow);
      expect(onAction).toHaveBeenCalledTimes(2);
      expect(onAction).toHaveBeenLastCalledWith("projects-1");
      expect(onSelectionChange).toHaveBeenCalledTimes(0);

      await user.keyboard("{Enter}");
      expect(onAction).toHaveBeenCalledTimes(3);
      expect(onAction).toHaveBeenLastCalledWith("projects-1");
      expect(onSelectionChange).toHaveBeenCalledTimes(0);
    });

    it('should prevent Esc from clearing selection if escapeKeyBehavior is "none"', async () => {
      const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "multiple", escapeKeyBehavior: "none" }} />);

      const rows = getAllByRole("row");
      await user.click(rows[0]!);
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
      expect(new Set(onSelectionChange.mock.calls[0]![0])).toEqual(new Set(["Photos"]));

      await user.click(rows[1]!);
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
      expect(new Set(onSelectionChange.mock.calls[1]![0])).toEqual(new Set(["Photos", "projects"]));

      await user.keyboard("{Escape}");
      expect(onSelectionChange).toHaveBeenCalledTimes(2);
      expect(rows[0]).toHaveAttribute("data-selected");
      expect(rows[1]).toHaveAttribute("data-selected");
    });

    it("should support onScroll", () => {
      const onScroll = vi.fn();
      const { getByRole } = renderIt(() => <StaticTree treeProps={{ onScroll }} />);
      fireEvent.scroll(getByRole("treegrid"));
      expect(onScroll).toHaveBeenCalled();
    });

    // TODO(B5 selectable-item): the row click does not stop propagation yet (RA usePress), so the window click
    // listener also sees the row click; mouse link cases skipped until then (same as grid-list.browser.test.tsx).
    const PENDING_CLICK_STOP = true;
    describe("links", () => {
      describe.each(["mouse", "keyboard"])("%s", (type) => {
        // Rivet: `{Space}` is not a user-event key name (it types key "Space", code "Unknown"); `[Space]` (by code) types " ".
        const trigger = async (item: HTMLElement, key = "Enter") => {
          if (type === "mouse") await user.click(item);
          else await user.keyboard(key === "Space" ? "[Space]" : `{${key}}`);
        };

        it.skipIf(type === "mouse" && PENDING_CLICK_STOP)('should support links with selectionMode="none"', async () => {
          const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "none" }} rowProps={{ href: "https://google.com/" }} />);
          const items = getAllByRole("row");
          for (const item of items) {
            expect(item.tagName).not.toBe("A");
            expect(item).toHaveAttribute("data-href");
          }

          if (type === "keyboard") await user.tab();

          const onClick = mockClickDefault();
          await trigger(items[0]!);
          expect(onClick).toHaveBeenCalledTimes(1);
          expect(onClick.mock.calls[0]![0].target).toBeInstanceOf(HTMLAnchorElement);
          expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
        });

        it.skipIf(type === "mouse" && PENDING_CLICK_STOP).each(["single", "multiple"])(
          'should support links with selectionBehavior="toggle" selectionMode="%s"',
          async (selectionMode) => {
            const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode }} rowProps={{ href: "https://google.com/" }} />);
            const items = getAllByRole("row");
            for (const item of items) {
              expect(item.tagName).not.toBe("A");
              expect(item).toHaveAttribute("data-href");
            }

            if (type === "keyboard") await user.tab();

            const onClick = mockClickDefault();
            await trigger(items[0]!);
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(onClick.mock.calls[0]![0].target).toBeInstanceOf(HTMLAnchorElement);
            expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");

            await user.click(within(items[0]!).getByRole("checkbox"));
            expect(items[0]).toHaveAttribute("aria-selected", "true");

            if (type === "keyboard") {
              await user.keyboard("{ArrowLeft}");
              await user.keyboard("{ArrowDown}");
            }
            await trigger(items[1]!, "Space");
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(items[1]).toHaveAttribute("aria-selected", "true");
          },
        );

        it.skipIf(type === "mouse" && PENDING_CLICK_STOP).each(["single", "multiple"])(
          'should support links with selectionBehavior="replace" selectionMode="%s"',
          async (selectionMode) => {
            const { getAllByRole } = renderIt(() => (
              <StaticTree treeProps={{ selectionMode, selectionBehavior: "replace" }} rowProps={{ href: "https://google.com/" }} />
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
              // As upstream: `{Space}` types key "Space" (not " "), which no handler treats as Space; the row is
              // selected by the focus entry (useGridList `selectOnFocus` with selectionBehavior "replace").
              await user.keyboard("{Space}");
            }
            expect(onClick).not.toHaveBeenCalled();
            expect(items[0]).toHaveAttribute("aria-selected", "true");

            if (type === "mouse") await user.dblClick(items[0]!);
            else await user.keyboard("{Enter}");
            expect(onClick).toHaveBeenCalledTimes(1);
            expect(onClick.mock.calls[0]![0].target).toBeInstanceOf(HTMLAnchorElement);
            expect((onClick.mock.calls[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
          },
        );
      });
    });

    describe("keyboard interactions", () => {
      describe.each(["DynamicTree", "DynamicSectionTree"])("%s", (comp) => {
        const TreeExample = comp === "DynamicSectionTree" ? DynamicSectionTree : DynamicTree;

        function getAllRows(tree: HTMLElement) {
          const rowGroups = within(tree).queryAllByRole("rowgroup");
          return rowGroups.length > 0 ? rowGroups.flatMap((rowGroup) => within(rowGroup).queryAllByRole("row").slice(1)) : within(tree).queryAllByRole("row");
        }

        it("left and right arrows should navigate between interactive elements in the row", async () => {
          const { getByRole } = renderIt(() => <TreeExample treeProps={{ selectionMode: "multiple" }} />);
          const tree = getByRole("treegrid");
          const expandableRow = getAllRows(tree)[0]!;
          const buttons = within(expandableRow).getAllByRole("button");
          const checkbox = within(expandableRow).getByRole("checkbox");

          await user.tab();
          expect(expandableRow).toHaveAttribute("aria-expanded", "true");
          expect(document.activeElement).toBe(expandableRow);
          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(checkbox);
          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(buttons[1]);
          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(buttons[2]);
          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(expandableRow);

          // Test that if focus is on the row that right/left will expand/collapse if it isn't already
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(expandableRow);
          expect(expandableRow).toHaveAttribute("aria-expanded", "false");

          await user.keyboard("{ArrowRight}");
          expect(document.activeElement).toBe(expandableRow);
          expect(expandableRow).toHaveAttribute("aria-expanded", "true");

          // Resume testing navigation to interacive elements
          await user.keyboard("{ArrowLeft}");
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(buttons[2]);
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(buttons[1]);
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(checkbox);
        });

        it("should support type ahead", async () => {
          const { getByRole, queryByText } = renderIt(() => <TreeExample />);
          await user.tab();
          const tree = getByRole("treegrid");
          const rows = getAllRows(tree);
          expect(document.activeElement).toBe(rows[0]);
          await user.keyboard("Reports 1ABC");
          expect(document.activeElement).toBe(rows[16]);

          await wait(1100);
          await user.keyboard("Pro");
          expect(document.activeElement).toBe(rows[0]);

          // Test typeahead doesn't match against hidden rows
          await user.click(rows[12]!);
          expect(queryByText("Reports 1ABC")).toBeFalsy();
          await wait(1100);
          await user.keyboard("Reports 1ABC");
          expect(document.activeElement).toBe(rows[12]);
          expect(rows[12]).toHaveAttribute("aria-label", "Reports");
        });

        it("should support collapse key to navigate to parent", async () => {
          const { getByRole } = renderIt(() => <TreeExample />);
          await user.tab();
          const tree = getByRole("treegrid");
          let rows = getAllRows(tree);
          expect(rows).toHaveLength(20);
          expect(document.activeElement).toBe(rows[0]);
          expect(document.activeElement).toHaveAttribute("data-expanded", "true");

          // Navigate down to Project 2B
          await user.keyboard("{ArrowDown}");
          await user.keyboard("{ArrowDown}");
          await user.keyboard("{ArrowRight}");
          await user.keyboard("{ArrowDown}");
          await user.keyboard("{ArrowDown}");
          expect(document.activeElement).toBe(rows[4]);
          expect(document.activeElement).toHaveAttribute("aria-label", "Project 2B");

          // Collapse key on leaf node should move focus to parent (Projects)
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(rows[2]);
          expect(document.activeElement).toHaveAttribute("aria-label", "Project 2");
          expect(document.activeElement).toHaveAttribute("data-expanded", "true");

          // Collapse key on expanded parent should collapse it
          await user.keyboard("{ArrowLeft}");
          rows = getAllRows(tree);
          expect(rows.length).toBeLessThan(20);
          expect(document.activeElement).toBe(rows[2]);
          expect(document.activeElement).toHaveAttribute("aria-label", "Project 2");
          expect(document.activeElement).not.toHaveAttribute("data-expanded");

          // Collapse key again on now-collapsed parent should move to its parent
          await user.keyboard("{ArrowLeft}");
          expect(document.activeElement).toBe(rows[0]);
          expect(document.activeElement).toHaveAttribute("aria-label", "Projects");
        });

        it("should navigate between visible rows when using Arrow Up/Down", async () => {
          const { getByRole } = renderIt(() => <TreeExample />);
          await user.tab();
          const tree = getByRole("treegrid");
          let rows = getAllRows(tree);
          expect(rows).toHaveLength(20);
          expect(document.activeElement).toBe(rows[0]);
          await user.keyboard("{ArrowDown}");
          expect(document.activeElement).toBe(rows[1]);
          expect(rows[1]).toHaveAttribute("aria-label", "Project 1");
          await user.keyboard("{ArrowUp}");

          // Collapse parent row and try arrow navigation again
          await user.keyboard("{ArrowLeft}");
          rows = getAllRows(tree);
          expect(rows).toHaveLength(9);
          await user.keyboard("{ArrowDown}");
          expect(document.activeElement).toBe(rows[1]);
          expect(rows[1]).toHaveAttribute("aria-label", "Reports");
          await user.keyboard("{ArrowUp}");
          expect(document.activeElement).toBe(rows[0]);
          expect(rows[0]).toHaveAttribute("aria-label", "Projects");
        });

        it("should navigate between visible rows when using Home/End", async () => {
          const { getByRole } = renderIt(() => <TreeExample />);
          await user.tab();
          const tree = getByRole("treegrid");
          let rows = getAllRows(tree);
          expect(rows).toHaveLength(20);
          expect(document.activeElement).toBe(rows[0]);
          await user.keyboard("{End}");
          expect(document.activeElement).toBe(rows[19]);
          expect(rows[19]).toHaveAttribute("aria-label", "Reports 2");
          await user.keyboard("{Home}");
          expect(document.activeElement).toBe(rows[0]);

          // Collapse the 2nd top level row and try End/Home again
          await user.click(rows[12]!);
          rows = getAllRows(tree);
          expect(rows).toHaveLength(13);
          await user.keyboard("{Home}");
          await user.keyboard("{End}");
          expect(document.activeElement).toBe(rows[12]);
          expect(rows[12]).toHaveAttribute("aria-label", "Reports");
        });
      });
    });
  });

  describe("expanding and collapsing", () => {
    describe.each(["mouse", "keyboard"])("%s", (type) => {
      const trigger = async (item: HTMLElement, key = "ArrowRight") => {
        if (type === "mouse") await user.click(item);
        else await user.keyboard(`{${key}}`);
      };

      it("should expand/collapse a row when clicking/using Enter on the row itself and there arent any other primary actions", async () => {
        const { getAllByRole } = renderIt(() => <DynamicTree />);
        let rows = getAllByRole("row");
        expect(rows).toHaveLength(20);

        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-has-child-items", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);

        // Check we can open/close a top level row
        await trigger(rows[0]!, "Enter");
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).not.toHaveAttribute("data-expanded");
        expect(rows[0]).toHaveAttribute("data-has-child-items", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(1);
        // Note that the children of the parent row will still be in the "expanded" array
        expect(new Set(onExpandedChange.mock.calls[0]![0])).toEqual(new Set(["project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        rows = getAllByRole("row");
        expect(rows).toHaveLength(9);

        await trigger(rows[0]!, "Enter");
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-has-child-items", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(2);
        expect(new Set(onExpandedChange.mock.calls[1]![0])).toEqual(
          new Set(["projects", "project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]),
        );
        rows = getAllByRole("row");
        expect(rows).toHaveLength(20);

        await user.keyboard("{ArrowDown}");
        await user.keyboard("{ArrowDown}");
        expect(document.activeElement).toBe(rows[2]);
        expect(rows[2]).toHaveAttribute("data-expanded", "true");
        expect(rows[2]).toHaveAttribute("data-has-child-items", "true");

        // Check we can close a nested row and it doesn't affect the parent
        await trigger(rows[2]!, "ArrowLeft");
        expect(document.activeElement).toBe(rows[2]);
        expect(rows[2]).not.toHaveAttribute("data-expanded");
        expect(rows[2]).toHaveAttribute("data-has-child-items", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-has-child-items", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(3);
        expect(new Set(onExpandedChange.mock.calls[2]![0])).toEqual(new Set(["projects", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        rows = getAllByRole("row");
        expect(rows).toHaveLength(17);

        // Check behavior of onExpandedChange when a nested row is already closed and the parent is collapsed
        await user.keyboard("{ArrowUp}");
        await user.keyboard("{ArrowUp}");
        await trigger(rows[0]!, "ArrowLeft");
        expect(document.activeElement).toBe(rows[0]);
        expect(onExpandedChange).toHaveBeenCalledTimes(4);
        expect(new Set(onExpandedChange.mock.calls[3]![0])).toEqual(new Set(["project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        rows = getAllByRole("row");
        expect(rows).toHaveLength(9);

        // Check that the nested collapsed row is still closed when the parent is reexpanded
        await trigger(rows[0]!, "ArrowRight");
        expect(document.activeElement).toBe(rows[0]);
        expect(onExpandedChange).toHaveBeenCalledTimes(5);
        expect(new Set(onExpandedChange.mock.calls[4]![0])).toEqual(new Set(["projects", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        rows = getAllByRole("row");
        expect(rows).toHaveLength(17);
      });

      it("should not expand when clicking/using Enter on the row if the row is selectable", async () => {
        const { getAllByRole } = renderIt(() => <DynamicTree treeProps={{ selectionMode: "multiple" }} />);
        const rows = getAllByRole("row");

        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        expect(onSelectionChange).toHaveBeenCalledTimes(0);

        await trigger(rows[0]!, "Enter");
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        expect(onSelectionChange).toHaveBeenCalledTimes(1);
        expect(new Set(onSelectionChange.mock.calls[0]![0])).toEqual(new Set(["projects"]));

        await trigger(rows[0]!, "Enter");
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        expect(onSelectionChange).toHaveBeenCalledTimes(2);
        expect(new Set(onSelectionChange.mock.calls[1]![0])).toEqual(new Set([]));

        const chevron = within(rows[0]!).getAllByRole("button")[0]!;
        await trigger(chevron, "ArrowLeft");
        expect(rows[0]).toHaveAttribute("aria-expanded", "false");
        expect(rows[0]).not.toHaveAttribute("data-expanded");
        expect(onExpandedChange).toHaveBeenCalledTimes(1);
        expect(new Set(onExpandedChange.mock.calls[0]![0])).toEqual(new Set(["project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        expect(onSelectionChange).toHaveBeenCalledTimes(2);
      });

      it("should not expand when clicking/using Enter on the row if the row has an action", async () => {
        const { getAllByRole } = renderIt(() => <DynamicTree treeProps={{ onAction }} />);
        const rows = getAllByRole("row");

        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        expect(onAction).toHaveBeenCalledTimes(0);

        await trigger(rows[0]!, "Enter");
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onAction).toHaveBeenLastCalledWith("projects");

        const chevron = within(rows[0]!).getAllByRole("button")[0]!;
        await trigger(chevron, "ArrowLeft");
        expect(rows[0]).toHaveAttribute("aria-expanded", "false");
        expect(rows[0]).not.toHaveAttribute("data-expanded");
        expect(onExpandedChange).toHaveBeenCalledTimes(1);
        expect(new Set(onExpandedChange.mock.calls[0]![0])).toEqual(new Set(["project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
        expect(onAction).toHaveBeenCalledTimes(1);
      });

      it("should not expand when clicking/using Enter on the row if the row has a link", async () => {
        const { getAllByRole } = renderIt(() => <DynamicTree rowProps={{ href: "https://google.com" }} />);
        const rows = getAllByRole("row");
        expect(rows[0]).toHaveAttribute("data-href");

        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);

        const onClick = mockClickDefault();
        await trigger(rows[0]!, "Enter");
        const anchorClicks = onClick.mock.calls.filter((c) => c[0].target instanceof HTMLAnchorElement);
        expect(anchorClicks).toHaveLength(1);
        expect((anchorClicks[0]![0].target as HTMLAnchorElement).href).toBe("https://google.com/");
        expect(rows[0]).toHaveAttribute("aria-expanded", "true");
        expect(rows[0]).toHaveAttribute("data-expanded", "true");
        expect(onExpandedChange).toHaveBeenCalledTimes(0);
        // Upstream (jsdom): the synthetic link click blurs the row. Chromium keeps focus on the row for a
        // prevented navigation; Rivet: only assert focus left nothing else focused.
        if (document.activeElement !== rows[0]) expect(document.activeElement).toBe(document.body);
        else (document.activeElement as HTMLElement).blur();

        await user.tab();
        const chevron = within(rows[0]!).getAllByRole("button")[0]!;
        await trigger(chevron, "ArrowLeft");
        expect(rows[0]).toHaveAttribute("aria-expanded", "false");
        expect(rows[0]).not.toHaveAttribute("data-expanded");
        expect(onExpandedChange).toHaveBeenCalledTimes(1);
        expect(new Set(onExpandedChange.mock.calls[0]![0])).toEqual(new Set(["project-2", "project-5", "reports", "reports-1", "reports-1A", "reports-1AB"]));
      });
    });

    it("should apply the proper attributes to the chevron", async () => {
      const { getAllByRole } = renderIt(() => <DynamicTree />);
      const rows = getAllByRole("row");
      const chevron = within(rows[0]!).getAllByRole("button")[0]!;

      await user.tab();
      expect(rows[0]).toHaveAttribute("aria-expanded", "true");
      expect(chevron).toHaveAttribute("aria-label", "Collapse");
      expect(chevron).toHaveAttribute("slot", "chevron");

      await user.click(rows[0]!);
      expect(rows[0]).toHaveAttribute("aria-expanded", "false");
      expect(chevron).toHaveAttribute("aria-label", "Expand");
    });
  });

  describe("empty state", () => {
    it("should allow the user to tab to the empty tree", async () => {
      const { getAllByRole, getByRole } = renderIt(() => (
        <Tree
          class={({ isFocused, isFocusVisible }: any) => `isFocused: ${isFocused()}, isFocusVisible: ${isFocusVisible()}`}
          aria-label="test empty tree"
          items={[]}
          renderEmptyState={({ isFocused, isFocusVisible }) => <span>{`Nothing in tree, isFocused: ${isFocused()}, isFocusVisible: ${isFocusVisible()}`}</span>}
        >
          {() => (
            <TreeItem textValue="dummy value">
              <TreeItemContent>Dummy Value</TreeItemContent>
            </TreeItem>
          )}
        </Tree>
      ));

      const tree = getByRole("treegrid");
      expect(tree).toHaveAttribute("data-empty", "true");
      expect(tree).not.toHaveAttribute("data-focused");
      expect(tree).not.toHaveAttribute("data-focus-visible");
      expect(tree).toHaveClass("isFocused: false, isFocusVisible: false");

      const row = getAllByRole("row")[0]!;
      expect(row).toHaveAttribute("aria-level", "1");
      expect(row).not.toHaveAttribute("aria-posinset");
      expect(row).not.toHaveAttribute("aria-setsize");
      const gridCell = within(row).getByRole("gridcell");
      expect(gridCell).toHaveTextContent("Nothing in tree, isFocused: false, isFocusVisible: false");

      await user.tab();
      expect(document.activeElement).toBe(tree);
      expect(tree).toHaveAttribute("data-empty", "true");
      expect(tree).toHaveAttribute("data-focused", "true");
      expect(tree).toHaveAttribute("data-focus-visible", "true");
      expect(tree).toHaveClass("isFocused: true, isFocusVisible: true");
      expect(gridCell).toHaveTextContent("Nothing in tree, isFocused: true, isFocusVisible: true");

      await user.tab();
      expect(tree).toHaveAttribute("data-empty", "true");
      expect(tree).not.toHaveAttribute("data-focused");
      expect(tree).not.toHaveAttribute("data-focus-visible");
      expect(tree).toHaveClass("isFocused: false, isFocusVisible: false");
      expect(row).toHaveAttribute("aria-level", "1");
      expect(row).not.toHaveAttribute("aria-posinset");
      expect(row).not.toHaveAttribute("aria-setsize");
      expect(gridCell).toHaveTextContent("Nothing in tree, isFocused: false, isFocusVisible: false");
    });
  });

  describe("load more", () => {
    it("should render the load more element with the expected attributes", () => {
      const { getAllByRole } = renderIt(() => <LoadingMoreTree isLoading />);

      const rows = getAllByRole("row");
      expect(rows).toHaveLength(22);
      const subRowLoader = rows[6]!;
      expect(subRowLoader).toHaveAttribute("data-level", "3");
      expect(subRowLoader).toHaveTextContent("Level 3 loading spinner");

      const rootLoader = rows[21]!;
      expect(rootLoader).toHaveAttribute("data-level", "1");
      expect(rootLoader).toHaveTextContent("Load more spinner");

      expect(within(rootLoader).getByRole("gridcell")).toHaveAttribute("aria-colindex", "1");
    });

    it("should not focus the load more row when using ArrowDown/ArrowUp", async () => {
      const { getAllByRole } = renderIt(() => <LoadingMoreTree isLoading />);

      const rows = getAllByRole("row");
      expect(rows[6]).toHaveTextContent("Level 3 loading spinner");

      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      for (let i = 0; i < 5; i++) await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(rows[5]);

      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(rows[7]);

      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(rows[5]);
    });

    it("should not focus the load more row when using End", async () => {
      const { getAllByRole } = renderIt(() => <LoadingMoreTree isLoading />);

      const rows = getAllByRole("row");
      expect(rows[21]).toHaveTextContent("Load more spinner");

      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.keyboard("{End}");
      expect(document.activeElement).toBe(rows[20]);

      // Check that it didn't shift the focusedkey to the loader key even if DOM focus didn't shift to the loader
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(rows[19]);
    });

    it("should not focus the load more row when using PageDown", async () => {
      const { getAllByRole } = renderIt(() => <LoadingMoreTree isLoading />);

      const rows = getAllByRole("row");
      expect(rows[21]).toHaveTextContent("Load more spinner");

      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.keyboard("{PageDown}");
      expect(document.activeElement).toBe(rows[20]);

      // Check that it didn't shift the focusedkey to the loader key even if DOM focus didn't shift to the loader
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(rows[19]);
    });

    it("should not render no results state and the loader at the same time", () => {
      let { getByRole, getAllByRole } = renderIt(() => <EmptyLoadingTree isLoading />);

      let rows = getAllByRole("row");
      expect(rows).toHaveLength(1);
      expect(getByRole("treegrid")).toHaveAttribute("data-empty", "true");
      expect(rows[0]).toHaveTextContent("Root level loading spinner");

      cleanup();
      ({ getByRole, getAllByRole } = renderIt(() => <EmptyLoadingTree />));

      rows = getAllByRole("row");
      expect(rows).toHaveLength(1);
      expect(getByRole("treegrid")).toHaveAttribute("data-empty", "true");
      expect(rows[0]).toHaveTextContent("Nothing in tree");
    });
  });

  describe("loading sentinels", () => {
    const LoadingSentinelTree = (props: any) => {
      const { isLoading, onLoadMore, ...treeProps } = props;
      return (
        <Tree aria-label="test tree" {...treeProps}>
          <StaticTreeItem id="Photos" textValue="Photos">
            Photos
          </StaticTreeItem>
          <StaticTreeItem id="projects" textValue="Projects" title="Projects">
            <StaticTreeItem id="projects-1" textValue="Projects-1" title="Projects-1">
              <StaticTreeItem id="projects-1A" textValue="Projects-1A">
                Projects-1A
              </StaticTreeItem>
              <TreeLoadMoreItem isLoading={isLoading} onLoadMore={onLoadMore}>
                Loading...
              </TreeLoadMoreItem>
            </StaticTreeItem>
            <StaticTreeItem id="projects-2" textValue="Projects-2">
              Projects-2
            </StaticTreeItem>
            <StaticTreeItem id="projects-3" textValue="Projects-3">
              Projects-3
            </StaticTreeItem>
          </StaticTreeItem>
          <TreeLoadMoreItem isLoading={isLoading} onLoadMore={onLoadMore}>
            Loading...
          </TreeLoadMoreItem>
        </Tree>
      );
    };

    it("should render the loading elements when loading", async () => {
      const expandedKeys = signal(new Set<string>());
      const tree = renderIt(() => <LoadingSentinelTree isLoading expandedKeys={expandedKeys} />);

      const treeTester = testUtilUser.createTester("Tree", { root: tree.getByRole("treegrid") });
      let rows = treeTester.getRows();
      expect(rows).toHaveLength(3);
      let loaderRow = rows[2]!;
      expect(loaderRow).toHaveTextContent("Loading...");

      const sentinel = tree.getByTestId("loadMoreSentinel");
      expect(sentinel.closest("[inert]")).toBeTruthy();

      // Should render the second sentinel if the row is expanded
      expandedKeys.set(new Set(["projects", "projects-1"]));
      await flush();
      rows = treeTester.getRows();
      expect(rows).toHaveLength(8);
      const newLoaderRow = rows[4]!;
      expect(newLoaderRow).toHaveTextContent("Loading...");

      loaderRow = rows[7]!;
      expect(loaderRow).toHaveTextContent("Loading...");
      expect(tree.queryAllByTestId("loadMoreSentinel")).toHaveLength(2);
    });

    it("should render the sentinel but not the loading indicator when not loading", async () => {
      const tree = renderIt(() => <LoadingSentinelTree />);

      const treeTester = testUtilUser.createTester("Tree", { root: tree.getByRole("treegrid") });
      expect(treeTester.getRows()).toHaveLength(2);
      expect(tree.queryByText("Loading...")).toBeFalsy();
      expect(tree.getByTestId("loadMoreSentinel")).toBeInTheDocument();
    });

    it("should only fire loadMore when intersection is detected regardless of loading state", async () => {
      // setupIntersectionObserverMock: a mock IntersectionObserver whose callback the test triggers.
      const observe = vi.fn();
      let instance: { callback: IntersectionObserverCallback } | null = null;
      class MockIntersectionObserver {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
          this.callback = callback;
          instance = this;
        }
        observe(el: Element) {
          observe(el);
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
      vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
      try {
        const onLoadMore = vi.fn();
        const isLoading = signal(true);
        const tree = renderIt(() => <LoadingSentinelTree onLoadMore={onLoadMore} isLoading={isLoading} />);
        await flush();
        const sentinel = tree.getByTestId("loadMoreSentinel");
        expect(observe).toHaveBeenLastCalledWith(sentinel);
        expect(onLoadMore).toHaveBeenCalledTimes(0);

        instance!.callback([{ isIntersecting: true } as IntersectionObserverEntry], instance as never);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
        observe.mockClear();

        // Rivet: `isLoading` changes in place (no re-render): the observer stays as is; upstream re-renders
        // (new collection → re-observe). The sentinel keeps firing regardless of the loading state.
        isLoading.set(false);
        await flush();
        expect(onLoadMore).toHaveBeenCalledTimes(1);

        instance!.callback([{ isIntersecting: true } as IntersectionObserverEntry], instance as never);
        expect(onLoadMore).toHaveBeenCalledTimes(2);
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it.skip("virtualized loaders (TreeLoadMoreItem inside CollectionVirtualizer not covered yet)", () => {});
  });

  describe("shouldSelectOnPressUp", () => {
    it("should select an item on pressing down when shouldSelectOnPressUp is not provided", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "single", onSelectionChange }} />);
      const items = getAllByRole("row");

      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);

      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it("should select an item on pressing down when shouldSelectOnPressUp is false", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "single", onSelectionChange, shouldSelectOnPressUp: false }} />);
      const items = getAllByRole("row");

      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);

      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });

    it("should select an item on pressing up when shouldSelectOnPressUp is true", async () => {
      const onSelectionChange = vi.fn();
      const { getAllByRole } = renderIt(() => <StaticTree treeProps={{ selectionMode: "single", onSelectionChange, shouldSelectOnPressUp: true }} />);
      const items = getAllByRole("row");

      await user.pointer({ target: items[0]!, keys: "[MouseLeft>]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(0);

      await user.pointer({ target: items[0]!, keys: "[/MouseLeft]" });
      expect(onSelectionChange).toHaveBeenCalledTimes(1);
    });
  });

  describe.skip("drag and drop (DnD lane: dragAndDropHooks not wired in Tree yet)", () => {
    it("ports pending", () => {});
  });

  // TODO(C6a): gridListItemProps does not merge the item's onPress* / onClick props yet (grid-list.browser.test.tsx skips
  // its "press events" case too); enable with C6a.
  const PENDING_ITEM_PRESS_PROPS = true;
  describe("press events", () => {
    it.skipIf(PENDING_ITEM_PRESS_PROPS).each(["mouse", "keyboard"] as const)("should support press events on items when using %s", async (interactionType) => {
      const onAction = vi.fn();
      const onPressStart = vi.fn();
      const onPressEnd = vi.fn();
      const onPress = vi.fn();
      const onClick = vi.fn();
      const { getByRole } = renderIt(() => <StaticTree rowProps={{ onAction, onPressStart, onPressEnd, onPress, onClick }} />);
      const gridListTester = testUtilUser.createTester("GridList", { root: getByRole("treegrid") });
      await gridListTester.triggerRowAction({ row: 1, interactionType });

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onPressStart).toHaveBeenCalledTimes(1);
      expect(onPressEnd).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("sections", () => {
    it("should support sections", () => {
      const { getAllByRole } = renderIt(() => <StaticSectionTree />);

      const groups = getAllByRole("rowgroup");
      expect(groups).toHaveLength(2);

      expect(groups[0]).toHaveClass("rv-TreeSection");
      expect(groups[1]).toHaveClass("rv-TreeSection");

      expect(groups[0]!.getAttribute("aria-label")).toEqual("Section 1");

      expect(groups[1]).toHaveAttribute("aria-labelledby");
      const labelId = groups[1]!.getAttribute("aria-labelledby");
      const labelElement = labelId ? document.getElementById(labelId) : null;
      expect(labelElement).not.toBeNull();
      expect(labelElement).toHaveTextContent("Section 2");
    });
  });

  it("should have the expected attributes on the rows in sections", () => {
    const { getAllByRole } = renderIt(() => <StaticSectionTree />);

    const rows = getAllByRole("row");
    const rowNoChild = rows[0]!;
    expect(rowNoChild).toHaveAttribute("aria-label", "Photos");
    expect(rowNoChild).not.toHaveAttribute("aria-expanded");
    expect(rowNoChild).not.toHaveAttribute("data-expanded");
    expect(rowNoChild).toHaveAttribute("data-level", "1");
    expect(rowNoChild).not.toHaveAttribute("data-has-child-items");

    const header = rows[1]!;
    expect(header).toHaveClass("rv-TreeHeader");
    expect(within(header).getByRole("rowheader")).toHaveTextContent("Section 2");

    const rowWithChildren = rows[2]!;
    expect(rowWithChildren).toHaveAttribute("aria-label", "Projects");
    expect(rowWithChildren).toHaveAttribute("data-expanded", "true");
    expect(rowWithChildren).toHaveAttribute("data-level", "1");
    expect(rowWithChildren).toHaveAttribute("data-has-child-items", "true");

    const level2ChildRow = rows[3]!;
    expect(level2ChildRow).toHaveAttribute("aria-label", "Projects-1");
    expect(level2ChildRow).toHaveAttribute("data-expanded", "true");
    expect(level2ChildRow).toHaveAttribute("data-level", "2");
    expect(level2ChildRow).toHaveAttribute("data-has-child-items", "true");

    const level3ChildRow = rows[4]!;
    expect(level3ChildRow).toHaveAttribute("aria-label", "Projects-1A");
    expect(level3ChildRow).not.toHaveAttribute("data-expanded");
    expect(level3ChildRow).toHaveAttribute("data-level", "3");
    expect(level3ChildRow).not.toHaveAttribute("data-has-child-items");

    const level2ChildRow2 = rows[5]!;
    expect(level2ChildRow2).toHaveAttribute("aria-label", "Projects-2");
    expect(level2ChildRow2).not.toHaveAttribute("data-expanded");
    expect(level2ChildRow2).toHaveAttribute("data-level", "2");
    expect(level2ChildRow2).not.toHaveAttribute("data-has-child-items");

    const level2ChildRow3 = rows[6]!;
    expect(level2ChildRow3).toHaveAttribute("aria-label", "Projects-3");
    expect(level2ChildRow3).not.toHaveAttribute("data-expanded");
    expect(level2ChildRow3).toHaveAttribute("data-level", "2");
    expect(level2ChildRow3).not.toHaveAttribute("data-has-child-items");
  });

  it("should support dynamic trees with sections", () => {
    const { getByRole, getAllByRole } = renderIt(() => <DynamicSectionTree />);
    expect(getByRole("treegrid")).toHaveAttribute("class", "rv-Tree");

    const rows = getAllByRole("row");
    expect(rows).toHaveLength(22);

    let header = rows[0]!;
    expect(header).toHaveClass("rv-TreeHeader");
    expect(within(header).getByRole("rowheader")).toHaveTextContent("Section 1");

    expect(rows[1]).toHaveAttribute("aria-label", "Projects");
    expect(rows[1]).toHaveAttribute("aria-expanded", "true");
    expect(rows[1]).toHaveAttribute("aria-level", "1");
    expect(rows[1]).toHaveAttribute("aria-posinset", "1"); // aria-posinset value is relative to their section
    expect(rows[1]).toHaveAttribute("aria-setsize", "1"); // aria-setsize value is relative to their section
    expect(rows[1]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[3]).toHaveAttribute("aria-label", "Project 2");
    expect(rows[3]).toHaveAttribute("aria-expanded", "true");
    expect(rows[3]).toHaveAttribute("aria-level", "2");
    expect(rows[3]).toHaveAttribute("aria-posinset", "2");
    expect(rows[3]).toHaveAttribute("aria-setsize", "5");
    expect(rows[3]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[9]).toHaveAttribute("aria-label", "Project 5");
    expect(rows[9]).toHaveAttribute("aria-expanded", "true");
    expect(rows[9]).toHaveAttribute("aria-level", "2");
    expect(rows[9]).toHaveAttribute("aria-posinset", "5");
    expect(rows[9]).toHaveAttribute("aria-setsize", "5");
    expect(rows[9]).toHaveAttribute("data-has-child-items", "true");

    header = rows[13]!;
    expect(header).toHaveClass("rv-TreeHeader");
    expect(within(header).getByRole("rowheader")).toHaveTextContent("Section 2");

    expect(rows[14]).toHaveAttribute("aria-label", "Reports");
    expect(rows[14]).toHaveAttribute("aria-expanded", "true");
    expect(rows[14]).toHaveAttribute("aria-level", "1");
    expect(rows[14]).toHaveAttribute("aria-posinset", "1");
    expect(rows[14]).toHaveAttribute("aria-setsize", "1");
    expect(rows[14]).toHaveAttribute("data-has-child-items", "true");

    expect(rows[18]).toHaveAttribute("aria-label", "Reports 1ABC");
    expect(rows[18]).toHaveAttribute("aria-level", "5");
    expect(rows[18]).toHaveAttribute("aria-posinset", "1");
    expect(rows[18]).toHaveAttribute("aria-setsize", "1");
  });

  describe("tab navigation and textfields", () => {
    it("should not navigate rows when arrow keys are pressed while a text input child has focus", async () => {
      const { getByRole } = renderIt(() => <TreeWithTextFieldStory />);
      const treeTester = testUtilUser.createTester("Tree", { root: getByRole("treegrid") });
      const rows = treeTester.getRows();
      const input = getByRole("textbox", { name: "Name" });

      // tab past the before tree input
      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      expect(document.activeElement).toBe(input);

      await user.keyboard("{ArrowDown}");
      expect(document.activeElement).toBe(input);
      await user.keyboard("{ArrowUp}");
      expect(document.activeElement).toBe(input);
      await user.keyboard("{ArrowRight}");
      expect(document.activeElement).toBe(input);
      await user.keyboard("{ArrowLeft}");
      expect(document.activeElement).toBe(input);
    });

    it("should not trigger typeahead when typing in a text input child", async () => {
      const { getByRole } = renderIt(() => <TreeWithTextFieldStory />);
      const treeTester = testUtilUser.createTester("Tree", { root: getByRole("treegrid") });
      const rows = treeTester.getRows();
      const input = getByRole("textbox", { name: "Name" });

      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      expect(document.activeElement).toBe(input);

      await user.keyboard("row");
      expect(document.activeElement).toBe(input);
      expect(input).toHaveValue("row");
    });

    it("should not trigger selection when pressing Space in a text input child of a leaf row", async () => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => <TreeWithTextFieldStory selectionMode="multiple" onSelectionChange={onSelectionChange} />);
      const treeTester = testUtilUser.createTester("Tree", { root: getByRole("treegrid") });
      const rows = treeTester.getRows();
      const input = getByRole("textbox", { name: "Name" });

      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(input);

      await user.keyboard(" ");
      expect(input).toHaveValue(" ");
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("should allow typing space in the text input child of a parent row", async () => {
      const onSelectionChange = vi.fn();
      const { getByRole } = renderIt(() => <TreeWithTextFieldStory selectionMode="multiple" onSelectionChange={onSelectionChange} />);
      const treeTester = testUtilUser.createTester("Tree", { root: getByRole("treegrid") });
      const rows = treeTester.getRows();

      await user.tab();
      await user.tab();
      expect(document.activeElement).toBe(rows[0]);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{ArrowDown}");
      await user.tab();
      await user.tab();
      const parentInput = getByRole("textbox", { name: "row 1 input" });
      expect(document.activeElement).toBe(parentInput);

      await user.keyboard(" ");
      expect(parentInput).toHaveValue(" ");
      expect(onSelectionChange).not.toHaveBeenCalled();
    });
  });

  describe("focusMode and allowsArrowNavigation", () => {
    it('focusMode="child" auto-focuses first child when item receives focus', async () => {
      const { getByRole } = renderIt(() => (
        <Tree aria-label="Tab mode tree" keyboardNavigationBehavior="tab">
          <TreeItem id="item1" textValue="Item 1" focusMode="child">
            <TreeItemContent>
              {() => (
                <button tabIndex={0} aria-label="Item 1 action">
                  Go
                </button>
              )}
            </TreeItemContent>
          </TreeItem>
          <TreeItem id="item2" textValue="Item 2" focusMode="child">
            <TreeItemContent>
              {() => (
                <button tabIndex={0} aria-label="Item 2 action">
                  Go
                </button>
              )}
            </TreeItemContent>
          </TreeItem>
        </Tree>
      ));
      await user.tab();
      await frame();
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      await user.tab({ shift: true });
      await user.keyboard("{ArrowDown}");
      await frame();
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
    });

    it("allowsArrowNavigation allows arrow key navigation when focused on child", async () => {
      const { getByRole } = renderIt(() => (
        <Tree aria-label="Tab mode tree" keyboardNavigationBehavior="tab">
          <TreeItem id="item1" textValue="Item 1" focusMode="child" allowsArrowNavigation>
            <TreeItemContent>
              {() => (
                <button tabIndex={0} aria-label="Item 1 action">
                  Go
                </button>
              )}
            </TreeItemContent>
          </TreeItem>
          <TreeItem id="item2" textValue="Item 2" focusMode="child" allowsArrowNavigation>
            <TreeItemContent>
              {() => (
                <button tabIndex={0} aria-label="Item 2 action">
                  Go
                </button>
              )}
            </TreeItemContent>
          </TreeItem>
        </Tree>
      ));
      await user.tab();
      await frame();
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      await user.keyboard("{ArrowDown}");
      await frame();
      expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
    });

    describe('focusMode="child" with default arrow navigation', () => {
      it("ArrowDown from child navigates to first child of next item", async () => {
        const { getByRole } = renderIt(() => (
          <Tree aria-label="Tree">
            <TreeItem id="item1" textValue="Item 1" focusMode="child">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 1 action">
                  Go
                </button>
                <input />
              </TreeItemContent>
            </TreeItem>
            <TreeItem id="item2" textValue="Item 2" focusMode="child">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 2 action">
                  Go
                </button>
                <input />
              </TreeItemContent>
            </TreeItem>
            <TreeItem id="item3" textValue="Item 3" focusMode="child">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 3 action">
                  Go
                </button>
                <input />
              </TreeItemContent>
            </TreeItem>
          </Tree>
        ));
        await user.tab();
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.keyboard("{ArrowDown}");
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
        await user.keyboard("{ArrowDown}");
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 3 action" }));
      });

      it("ArrowUp from child navigates to first child of previous item", async () => {
        const { getByRole } = renderIt(() => (
          <Tree aria-label="Tree">
            <TreeItem id="item1" textValue="Item 1" focusMode="child">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 1 action">
                  Go
                </button>
                <input />
              </TreeItemContent>
            </TreeItem>
            <TreeItem id="item2" textValue="Item 2" focusMode="child">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 2 action">
                  Go
                </button>
                <input />
              </TreeItemContent>
            </TreeItem>
          </Tree>
        ));
        await user.tab();
        await user.keyboard("{ArrowDown}");
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 2 action" }));
        await user.keyboard("{ArrowUp}");
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
      });
    });

    describe('focusMode="row" (default) with tab navigation', () => {
      it("Tab into tree focuses row, Tab from row enters child, Shift+Tab returns to row", async () => {
        const { getByRole, getAllByRole } = renderIt(() => (
          <Tree aria-label="Tree" keyboardNavigationBehavior="tab">
            <TreeItem id="item1" textValue="Item 1">
              <TreeItemContent>
                <button tabIndex={0} aria-label="Item 1 action">
                  Go
                </button>
                <button tabIndex={0} aria-label="Item 1 action 2">
                  Go
                </button>
              </TreeItemContent>
            </TreeItem>
          </Tree>
        ));
        const rows = getAllByRole("row");
        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        await user.tab();
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.tab();
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action 2" }));
        await user.tab({ shift: true });
        await frame();
        expect(document.activeElement).toBe(getByRole("button", { name: "Item 1 action" }));
        await user.tab({ shift: true });
        expect(document.activeElement).toBe(rows[0]);
      });

      it("ArrowRight expands collapsed parent item in tab mode", async () => {
        const { getAllByRole } = renderIt(() => (
          <Tree aria-label="Tree" keyboardNavigationBehavior="tab">
            <TreeItem id="parent" textValue="Parent">
              <TreeItemContent>
                {({ hasChildItems, isExpanded }: any) => (
                  <>
                    {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
                    <span>Parent</span>
                  </>
                )}
              </TreeItemContent>
              <TreeItem id="child1" textValue="Child 1">
                <TreeItemContent>{() => <span>Child 1</span>}</TreeItemContent>
              </TreeItem>
            </TreeItem>
            <TreeItem id="item2" textValue="Item 2">
              <TreeItemContent>{() => <span>Item 2</span>}</TreeItemContent>
            </TreeItem>
          </Tree>
        ));
        const rows = getAllByRole("row");
        // Only parent and item2 visible initially (parent is collapsed)
        expect(rows).toHaveLength(2);
        await user.tab();
        expect(document.activeElement).toBe(rows[0]);
        // ArrowRight on a collapsed parent with children expands it (handleTreeExpansionKeys returns true)
        await user.keyboard("{ArrowRight}");
        expect(getAllByRole("row")).toHaveLength(3);
      });
    });
  });
});

// --- AriaTreeTests (test/AriaTree.test-util.tsx) -------------------------------------------------

interface AriaTreeTestProps {
  prefix?: string;
  renderers: {
    standard: () => HTMLElement;
    singleSelection?: () => HTMLElement;
    allInteractionsDisabled?: () => HTMLElement;
  };
}

const describeInteractions = (name: string, tests: (p: { interactionType: "mouse" | "keyboard" | "touch" }) => void) =>
  describe.each([{ interactionType: "mouse" as const }, { interactionType: "keyboard" as const }, { interactionType: "touch" as const }])(
    `${name} - $interactionType`,
    tests,
  );

const AriaTreeTests = ({ renderers, prefix }: AriaTreeTestProps): void => {
  describe(prefix ? prefix + "AriaTree" : "AriaTree", () => {
    let user: ReturnType<typeof userEvent.setup>;
    const testUtilUser = new User({ advanceTimer: (ms: number) => wait(ms) });

    beforeAll(() => {
      user = userEvent.setup();
    });

    it("should have the base set of aria and data attributes", () => {
      const root = renderers.standard();
      const treeTester = testUtilUser.createTester("Tree", { user, root });
      expect(treeTester.getTree()).toHaveAttribute("aria-label");

      for (const row of treeTester.getRows()) {
        expect(row).toHaveAttribute("aria-level");
        expect(row).toHaveAttribute("aria-posinset");
        expect(row).toHaveAttribute("aria-setsize");
      }
      expect(treeTester.getRows()[0]).not.toHaveAttribute("aria-expanded");
      expect(treeTester.getRows()[1]).toHaveAttribute("aria-expanded", "false");
    });

    describeInteractions("interaction", ({ interactionType }) => {
      it("should have the expected attributes on the rows", async () => {
        const root = renderers.standard();
        const treeTester = testUtilUser.createTester("Tree", { user, root, interactionType });
        await treeTester.toggleRowExpansion({ row: 1 });
        await treeTester.toggleRowExpansion({ row: 2 });

        const rows = treeTester.getRows();
        const rowNoChild = rows[0]!;
        expect(rowNoChild).toHaveAttribute("aria-label");
        expect(rowNoChild).not.toHaveAttribute("aria-expanded");
        expect(rowNoChild).toHaveAttribute("aria-level", "1");
        expect(rowNoChild).toHaveAttribute("aria-posinset", "1");
        expect(rowNoChild).toHaveAttribute("aria-setsize", "3");

        const rowWithChildren = rows[1]!;
        // Row has action since it is expandable but not selectable.
        expect(rowWithChildren).toHaveAttribute("aria-expanded", "true");
        expect(rowWithChildren).toHaveAttribute("aria-level", "1");
        expect(rowWithChildren).toHaveAttribute("aria-posinset", "2");
        expect(rowWithChildren).toHaveAttribute("aria-setsize", "3");

        const level2ChildRow = rows[2]!;
        expect(level2ChildRow).toHaveAttribute("aria-expanded", "true");
        expect(level2ChildRow).toHaveAttribute("data-expanded", "true");
        expect(level2ChildRow).toHaveAttribute("aria-level", "2");
        expect(level2ChildRow).toHaveAttribute("aria-posinset", "1");
        expect(level2ChildRow).toHaveAttribute("aria-setsize", "3");

        const level3ChildRow = rows[3]!;
        expect(level3ChildRow).not.toHaveAttribute("aria-expanded");
        expect(level3ChildRow).toHaveAttribute("aria-level", "3");
        expect(level3ChildRow).toHaveAttribute("aria-posinset", "1");
        expect(level3ChildRow).toHaveAttribute("aria-setsize", "1");

        const level2ChildRow2 = rows[4]!;
        expect(level2ChildRow2).not.toHaveAttribute("aria-expanded");
        expect(level2ChildRow2).toHaveAttribute("aria-level", "2");
        expect(level2ChildRow2).toHaveAttribute("aria-posinset", "2");
        expect(level2ChildRow2).toHaveAttribute("aria-setsize", "3");

        const level2ChildRow3 = rows[5]!;
        expect(level2ChildRow3).not.toHaveAttribute("aria-expanded");
        expect(level2ChildRow3).toHaveAttribute("aria-level", "2");
        expect(level2ChildRow3).toHaveAttribute("aria-posinset", "3");
        expect(level2ChildRow3).toHaveAttribute("aria-setsize", "3");

        // Collapse the first row and make sure it's collpased and that the inner rows are gone
        await treeTester.toggleRowExpansion({ row: 1 });
        expect(rowWithChildren).toHaveAttribute("aria-expanded", "false");
        expect(level2ChildRow).not.toBeInTheDocument();
      });
    });

    if (renderers.singleSelection) {
      describe("single selection", () => {
        describeInteractions("interaction", ({ interactionType }) => {
          // todo add test for using Space on the row to select it
          it("can select items", async () => {
            const root = renderers.singleSelection!();
            const treeTester = testUtilUser.createTester("Tree", { user, root, interactionType });

            let rows = treeTester.getRows();
            expect(rows[0]).toHaveAttribute("aria-selected", "false");
            expect(rows[1]).toHaveAttribute("aria-selected", "false");
            // disabled rows should not be selectable
            expect(rows[2]).not.toHaveAttribute("aria-selected");
            expect(within(rows[2]!).getByRole("checkbox")).toHaveAttribute("disabled");

            await treeTester.toggleRowSelection({ row: 0 });
            expect(rows[0]).toHaveAttribute("aria-selected", "true");
            expect(rows[1]).toHaveAttribute("aria-selected", "false");
            expect(treeTester.getSelectedRows()).toHaveLength(1);
            expect(within(treeTester.getRows()[0]!).getByRole("checkbox")).toBeChecked();

            await treeTester.toggleRowSelection({ row: 1 });
            expect(rows[0]).toHaveAttribute("aria-selected", "false");
            expect(rows[1]).toHaveAttribute("aria-selected", "true");
            expect(treeTester.getSelectedRows()).toHaveLength(1);
            expect(within(treeTester.getRows()[0]!).getByRole("checkbox")).not.toBeChecked();
            expect(within(treeTester.getRows()[1]!).getByRole("checkbox")).toBeChecked();

            await expect(treeTester.toggleRowSelection({ row: 2 })).rejects.toThrow();
            expect(rows[0]).toHaveAttribute("aria-selected", "false");
            expect(rows[1]).toHaveAttribute("aria-selected", "true");
            expect(rows[2]).not.toHaveAttribute("aria-selected");

            await treeTester.toggleRowExpansion({ row: 1 });
            rows = treeTester.getRows();
            // row 2 is now the subrow of row 1 because we expanded it
            expect(rows[2]).toHaveAttribute("aria-selected", "false");

            await treeTester.toggleRowSelection({ row: 2 });
            expect(rows[0]).toHaveAttribute("aria-selected", "false");
            expect(rows[1]).toHaveAttribute("aria-selected", "false");
            expect(rows[2]).toHaveAttribute("aria-selected", "true");

            // collapse and re-expand to make sure the selection persists
            await treeTester.toggleRowExpansion({ row: 1 });
            await treeTester.toggleRowExpansion({ row: 1 });
            rows = treeTester.getRows();
            expect(rows[2]).toHaveAttribute("aria-selected", "true");

            await treeTester.toggleRowSelection({ row: 2 });
            expect(rows[0]).toHaveAttribute("aria-selected", "false");
            expect(rows[1]).toHaveAttribute("aria-selected", "false");
            expect(rows[2]).toHaveAttribute("aria-selected", "false");

            await treeTester.toggleRowExpansion({ row: 1 });
            // items inside a disabled item can be selected
            await treeTester.toggleRowExpansion({ row: 2 });
            rows = treeTester.getRows();

            await treeTester.toggleRowSelection({ row: 3 });
            expect(rows[3]).toHaveAttribute("aria-selected", "true");
          });
        });
      });
    }

    if (renderers.allInteractionsDisabled) {
      describe("all interactions disabled", () => {
        describeInteractions("interaction", ({ interactionType }) => {
          it("should not be able to interact with the tree", async () => {
            const root = renderers.allInteractionsDisabled!();
            const treeTester = testUtilUser.createTester("Tree", { user, root, interactionType });

            const rows = treeTester.getRows();
            expect(rows[2]).toHaveAttribute("aria-expanded", "false");

            await expect(treeTester.toggleRowExpansion({ row: 2 })).rejects.toThrow();
            await expect(treeTester.toggleRowSelection({ row: 2 })).rejects.toThrow();
            expect(rows[2]).toHaveAttribute("aria-expanded", "false");
            expect(rows[2]).not.toHaveAttribute("aria-selected");
          });
        });
      });
    }
  });
};

const containerOf = (fn: () => unknown): HTMLElement => render(fn as never).container as HTMLElement;

const StaticAriaTree = (props: any) => (
  <Tree aria-label="test tree" {...props}>
    <StaticTreeItem id="Photos" textValue="Photos">
      Photos
    </StaticTreeItem>
    <StaticTreeItem id="projects" textValue="Projects" title="Projects">
      <StaticTreeItem id="projects-1" textValue="Projects-1" title="Projects-1">
        <StaticTreeItem id="projects-1A" textValue="Projects-1A">
          Projects-1A
        </StaticTreeItem>
      </StaticTreeItem>
      <StaticTreeItem id="projects-2" textValue="Projects-2">
        Projects-2
      </StaticTreeItem>
      <StaticTreeItem id="projects-3" textValue="Projects-3">
        Projects-3
      </StaticTreeItem>
    </StaticTreeItem>
    <StaticTreeItem id="school" textValue="School" title="School">
      <StaticTreeItem id="homework-1" textValue="Homework-1" title="Homework-1">
        <StaticTreeItem id="homework-1A" textValue="Homework-1A">
          Homework-1A
        </StaticTreeItem>
      </StaticTreeItem>
      <StaticTreeItem id="homework-2" textValue="Homework-2">
        Homework-2
      </StaticTreeItem>
      <StaticTreeItem id="homework-3" textValue="Homework-3">
        Homework-3
      </StaticTreeItem>
    </StaticTreeItem>
  </Tree>
);

AriaTreeTests({
  prefix: "rac-static",
  renderers: {
    standard: () => containerOf(() => <StaticAriaTree />),
    singleSelection: () => containerOf(() => <StaticAriaTree selectionMode="single" disabledKeys={["school"]} disabledBehavior="selection" />),
    allInteractionsDisabled: () => containerOf(() => <StaticAriaTree selectionMode="single" disabledKeys={["school"]} disabledBehavior="all" />),
  },
});

const controlledRows = [
  { id: "photos", name: "Photos 1" },
  {
    id: "projects",
    name: "Projects",
    childItems: [
      { id: "project-1", name: "Project 1", childItems: [{ id: "project-1A", name: "Project 1A" }] },
      { id: "project-2", name: "Project 2" },
      { id: "project-3", name: "Project 3" },
    ],
  },
  {
    id: "reports",
    name: "Reports",
    childItems: [
      { id: "reports-1", name: "Reports 1", childItems: [{ id: "reports-1A", name: "Reports 1A" }] },
      { id: "reports-2", name: "Reports 2" },
      { id: "reports-3", name: "Reports 3" },
    ],
  },
];

const ControlledDynamicTreeItem = (props: any) => (
  <TreeItem {...props}>
    <TreeItemContent>
      {({ isExpanded, hasChildItems, selectionMode, selectionBehavior }: any) => (
        <>
          {(selectionMode() !== "none" || props.href != null) && selectionBehavior() === "toggle" ? <Checkbox slot="selection" /> : null}
          {hasChildItems() ? <Button slot="chevron">{isExpanded() ? "Collapse" : "Expand"}</Button> : null}
          <Text>{props.title || props.children}</Text>
          <Button aria-label="Info">Info</Button>
          <Button aria-label="Menu">Menu</Button>
        </>
      )}
    </TreeItemContent>
    <Collection items={props.childItems}>
      {(item: any) => (
        <ControlledDynamicTreeItem childItems={item.childItems} textValue={item.name} href={props.href}>
          {item.name}
        </ControlledDynamicTreeItem>
      )}
    </Collection>
  </TreeItem>
);

function ControlledDynamicTree(props: any) {
  // React `useState` + `onExpandedChange={setExpanded}` → a two-way Signal.
  const expanded = signal(new Set<string | number>());
  return (
    <Tree {...props} items={controlledRows} aria-label="example dynamic tree" expandedKeys={expanded}>
      {(item: any) => (
        <ControlledDynamicTreeItem childItems={item.childItems} textValue={item.name}>
          {item.name}
        </ControlledDynamicTreeItem>
      )}
    </Tree>
  );
}

AriaTreeTests({
  prefix: "rac-controlled-dynamic",
  renderers: {
    standard: () => containerOf(() => <ControlledDynamicTree />),
    singleSelection: () => containerOf(() => <ControlledDynamicTree disabledKeys={["reports"]} selectionMode="single" disabledBehavior="selection" />),
    allInteractionsDisabled: () => containerOf(() => <ControlledDynamicTree disabledKeys={["reports"]} selectionMode="single" />),
  },
});

afterEach(() => {
  // AriaTreeTests renderers mount through `render`: unmounted by the file-level `cleanup`.
});

// RAC Tree.test.tsx "should support virtualizer" (ListLayout over the flattened expanded rows): real sizes (a 100 x 100
// scroller and `initialSize`) instead of mocked clientWidth / clientHeight.
describe("Tree virtualizer", () => {
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

  const folders = Array.from({ length: 10 }, (_, f) => ({
    id: "f" + f,
    name: "Folder " + f,
    files: Array.from({ length: 4 }, (_, i) => ({ id: "f" + f + "-" + i, name: "File " + f + "." + i })),
  }));
  it("should support virtualizer", async () => {
    const user = userEvent.setup();
    const { getByRole } = renderIt(() => (
      <CollectionVirtualizer layout={ListLayout} layoutOptions={{ rowHeight: 25 }} initialSize={{ width: 100, height: 100 }}>
        <Tree
          aria-label="Test"
          items={folders}
          defaultExpandedKeys={folders.map((f) => f.id)}
          selectionMode="single"
          style={{ display: "block", width: "100px", height: "100px", overflow: "auto" }}
        >
          {(folder: (typeof folders)[number]) => (
            <TreeItem id={folder.id} textValue={folder.name}>
              <TreeItemContent>{folder.name}</TreeItemContent>
              <Collection items={folder.files}>
                {(file: { id: string; name: string }) => (
                  <TreeItem id={file.id} textValue={file.name}>
                    <TreeItemContent>{file.name}</TreeItemContent>
                  </TreeItem>
                )}
              </Collection>
            </TreeItem>
          )}
        </Tree>
      </CollectionVirtualizer>
    ));
    const tree = getByRole("treegrid");
    let rows = within(tree).getAllByRole("row");
    expect(texts(rows)).toEqual(["Folder 0", "File 0.0", "File 0.1", "File 0.2", "File 0.3", "Folder 1", "File 1.0"]);
    expect(rows[1]).toHaveAttribute("aria-level", "2");
    tree.scrollTop = 200;
    fireEvent.scroll(tree);
    await frame();
    rows = within(tree).getAllByRole("row");
    expect(texts(rows)).toEqual(["File 1.1", "File 1.2", "File 1.3", "Folder 2", "File 2.0", "File 2.1", "File 2.2", "File 2.3"]);
    await new Promise((resolve) => setTimeout(resolve, 350));
    await user.click(rows[3]!);
    expect(rows[3]).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(rows[3]);
    await user.keyboard("{End}");
    await settle(tree);
    expect(document.activeElement?.textContent).toBe("File 9.3");
    expect(inView(tree, document.activeElement)).toBe(true);
    await user.keyboard("{Home}");
    await settle(tree);
    expect(document.activeElement?.textContent).toBe("Folder 0");
    // Collapsing a folder removes its files from the flattened rows.
    await user.keyboard("{ArrowLeft}");
    await settle(tree);
    expect(texts(within(tree).getAllByRole("row")).slice(0, 2)).toEqual(["Folder 0", "Folder 1"]);
  });
});
