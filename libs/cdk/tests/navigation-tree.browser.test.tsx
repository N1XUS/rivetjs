// Ported from react-aria-components test/NavigationTree.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); queries via `@testing-library/dom` `within`;
// `className` → `class`; render props are accessors (`isCurrent()`); `rerender(<X selectedRoute=…/>)` → a
// `selectedRoute` signal; `unmount` + `render` → `cleanup()` + `render`; real timers (jest fake timers +
// `runAllTimers` → a frame wait where focusMode "child" moves focus to the link after a frame); glyph chevron
// labels (▶ / •••) → text; default classes `rv-*`; `data-rac` assertions dropped (Rivet renders no `data-rac`).
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { Link } from "../link/index.tsx";
import {
  NavigationTree,
  NavigationTreeHeader,
  NavigationTreeItem,
  NavigationTreeItemContent,
  NavigationTreeSection,
  type NavigationTreeProps,
} from "../navigation-tree/index.tsx";

const renderIt = (fn: () => unknown) => {
  const result = render(fn as never);
  return Object.assign(within(result.container as HTMLElement), { container: result.container as HTMLElement });
};
const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

// libraries > (projects-1, projects-2); files is a top-level leaf.
function NavigationTreeExample(props: Partial<NavigationTreeProps<unknown>>) {
  return (
    <NavigationTree aria-label="Test NavigationTree" {...props}>
      <NavigationTreeItem id="files" href="/files" textValue="Your files">
        <NavigationTreeItemContent>
          <Link>Your files</Link>
        </NavigationTreeItemContent>
      </NavigationTreeItem>
      <NavigationTreeItem id="libraries" href="/libraries" textValue="Your libraries">
        <NavigationTreeItemContent>
          <Link>Your libraries</Link>
          <Button slot="chevron" aria-label="expand">
            Expand
          </Button>
        </NavigationTreeItemContent>
        <NavigationTreeItem id="projects-1" href="/projects-1" textValue="Projects 1">
          <NavigationTreeItemContent>
            <Link>Projects 1</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTreeItem>
    </NavigationTree>
  );
}

// files (leaf) then libraries > projects-1 > projects-1A
function ThreeLevelNavigationTreeExample(props: Partial<NavigationTreeProps<unknown>>) {
  return (
    <NavigationTree aria-label="Test NavigationTree" {...props}>
      <NavigationTreeItem id="files" href="/files" textValue="Your files">
        <NavigationTreeItemContent>
          <Link>Your files</Link>
        </NavigationTreeItemContent>
      </NavigationTreeItem>
      <NavigationTreeItem id="libraries" href="/libraries" textValue="Your libraries">
        <NavigationTreeItemContent>
          <Link>Your libraries</Link>
          <Button slot="chevron" aria-label="expand">
            Expand
          </Button>
        </NavigationTreeItemContent>
        <NavigationTreeItem id="projects-1" href="/projects-1" textValue="Projects 1">
          <NavigationTreeItemContent>
            <Link>Projects 1</Link>
            <Button slot="chevron" aria-label="expand">
              Expand
            </Button>
          </NavigationTreeItemContent>
          <NavigationTreeItem id="projects-1A" href="/projects-1A" textValue="Projects 1A">
            <NavigationTreeItemContent>
              <Link>Projects 1A</Link>
            </NavigationTreeItemContent>
          </NavigationTreeItem>
        </NavigationTreeItem>
      </NavigationTreeItem>
    </NavigationTree>
  );
}

// files (leaf) then a no-href "Section" row with a secondary-action button (not a chevron) and
// a linked child. Focus should land on the row itself, not jump into the secondary action.
function NoLinkActionMenuNavigationTreeExample(props: Partial<NavigationTreeProps<unknown>>) {
  return (
    <NavigationTree aria-label="Test NavigationTree" {...props}>
      <NavigationTreeItem id="files" href="/files" textValue="Your files">
        <NavigationTreeItemContent>
          <Link>Your files</Link>
        </NavigationTreeItemContent>
      </NavigationTreeItem>
      <NavigationTreeItem id="section" textValue="Section">
        <NavigationTreeItemContent>
          Section
          <Button aria-label="More actions">More</Button>
          <Button slot="chevron" aria-label="expand">
            Expand
          </Button>
        </NavigationTreeItemContent>
        <NavigationTreeItem id="section-2" href="/section-2" textValue="Section 2">
          <NavigationTreeItemContent>
            <Link>Section 2</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTreeItem>
    </NavigationTree>
  );
}

function NoHrefLinkNavigationTreeExample(props: Partial<NavigationTreeProps<unknown>>) {
  return (
    <NavigationTree aria-label="Test NavigationTree" {...props}>
      <NavigationTreeItem id="section" textValue="Section">
        <NavigationTreeItemContent>
          <Link>Section</Link>
          <Button slot="chevron" aria-label="expand">
            Expand
          </Button>
        </NavigationTreeItemContent>
        <NavigationTreeItem id="section-2" href="/section-2" textValue="Section 2">
          <NavigationTreeItemContent>
            <Link>Section 2</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTreeItem>
    </NavigationTree>
  );
}

// Section 1 has an aria-label instead of a NavigationTreeHeader (as is allowed by the underlying
// TreeSection); Section 2 uses a NavigationTreeHeader so both default classes get covered.
function SectionNavigationTreeExample(props: Partial<NavigationTreeProps<unknown>>) {
  return (
    <NavigationTree aria-label="Test NavigationTree" {...props}>
      <NavigationTreeSection aria-label="Section 1">
        <NavigationTreeItem id="files" href="/files" textValue="Your files">
          <NavigationTreeItemContent>
            <Link>Your files</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTreeSection>
      <NavigationTreeSection>
        <NavigationTreeHeader>Section 2</NavigationTreeHeader>
        <NavigationTreeItem id="libraries" href="/libraries" textValue="Your libraries">
          <NavigationTreeItemContent>
            <Link>Your libraries</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTreeSection>
    </NavigationTree>
  );
}

describe("NavigationTree", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });
  afterEach(() => cleanup());

  it("renders a treegrid with default classes and nested items", () => {
    const { getByRole, getAllByRole } = renderIt(() => <NavigationTreeExample />);
    const tree = getByRole("treegrid");
    expect(tree).toHaveClass("rv-NavigationTree");
    expect(tree).toHaveAttribute("aria-label", "Test NavigationTree");
    const rows = getAllByRole("row");
    expect(rows[0]).toHaveClass("rv-NavigationTreeItem");
    expect(getByRole("link", { name: "Your files" })).toBeInTheDocument();
  });

  it("expands and collapses a level with the chevron", async () => {
    const { getByRole, queryByRole } = renderIt(() => <NavigationTreeExample />);
    const librariesRow = getByRole("row", { name: "Your libraries" });
    expect(librariesRow).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("link", { name: "Projects 1" })).toBeNull();

    await user.click(within(librariesRow).getByRole("button"));
    expect(librariesRow).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("link", { name: "Projects 1" })).toBeInTheDocument();
  });

  it("exposes row render props via NavigationTreeItem className function", () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s">
        <NavigationTreeItem id="files" href="/files" textValue="Your files" class={({ level }: any) => `lvl-${level()}`}>
          <NavigationTreeItemContent>
            <Link>Your files</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(getByRole("row", { name: "Your files" })).toHaveClass("lvl-1");
  });

  it("marks the link matching selectedRoute with aria-current and data-current on the row", async () => {
    const route = signal<string | null>("/files");
    const { getByRole } = renderIt(() => <NavigationTreeExample selectedRoute={route} />);
    expect(getByRole("link", { name: "Your files" })).toHaveAttribute("aria-current", "page");
    expect(getByRole("row", { name: "Your files" })).toHaveAttribute("data-current", "true");
    expect(getByRole("link", { name: "Your libraries" })).not.toHaveAttribute("aria-current");
    expect(getByRole("row", { name: "Your libraries" })).not.toHaveAttribute("data-current");

    route.set("/libraries");
    await flush();
    expect(getByRole("link", { name: "Your files" })).not.toHaveAttribute("aria-current");
    expect(getByRole("link", { name: "Your libraries" })).toHaveAttribute("aria-current", "page");
  });

  it("exposes isCurrent through NavigationTreeItemContent render props", () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s" selectedRoute="/files">
        <NavigationTreeItem id="files" href="/files" textValue="Your files">
          <NavigationTreeItemContent>
            {({ isCurrent }: any) => <Link data-testid="files-link">{isCurrent() ? "current" : "not"}</Link>}
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(getByRole("link")).toHaveTextContent("current");
  });

  it("initial focus moves to the selected route", async () => {
    const { getByRole } = renderIt(() => <ThreeLevelNavigationTreeExample defaultExpandedKeys={["libraries"]} selectedRoute="/projects-1" />);
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Projects 1" })).toHaveFocus();
  });

  it("falls back to the closest visible ancestor when selectedRoute is under a collapsed parent", async () => {
    const { getByRole, queryByRole } = renderIt(() => <ThreeLevelNavigationTreeExample selectedRoute="/projects-1" />);
    expect(getByRole("row", { name: "Your libraries" })).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("link", { name: "Projects 1" })).toBeNull();
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Your libraries" })).toHaveFocus();
  });

  it("skips an expanded-but-hidden (by something higher up) ancestor and lands on the closest rendered ancestor", async () => {
    const { getByRole, queryByRole } = renderIt(() => <ThreeLevelNavigationTreeExample defaultExpandedKeys={["projects-1"]} selectedRoute="/projects-1A" />);
    expect(getByRole("row", { name: "Your libraries" })).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("link", { name: "Projects 1" })).toBeNull();
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Your libraries" })).toHaveFocus();
  });

  it("exposes isCurrentAncestor (render prop + data-current-ancestor) for every ancestor of the current item, regardless of expanded state", () => {
    function Example(props: Partial<NavigationTreeProps<unknown>>) {
      return (
        <NavigationTree aria-label="s" {...props}>
          <NavigationTreeItem id="libraries" href="/libraries" textValue="Your libraries">
            <NavigationTreeItemContent>
              {({ isCurrentAncestor }: any) => (
                <>
                  <Link>Your libraries</Link>
                  <Button slot="chevron" aria-label="expand">
                    Expand
                  </Button>
                  <span data-testid="anc">{String(isCurrentAncestor())}</span>
                </>
              )}
            </NavigationTreeItemContent>
            <NavigationTreeItem id="projects-1" href="/projects-1" textValue="Projects 1">
              <NavigationTreeItemContent>
                <Link>Projects 1</Link>
              </NavigationTreeItemContent>
            </NavigationTreeItem>
          </NavigationTreeItem>
        </NavigationTree>
      );
    }
    // Collapsed parent whose descendant is current.
    let { getByTestId, getByRole } = renderIt(() => <Example selectedRoute="/projects-1" />);
    expect(getByTestId("anc")).toHaveTextContent("true");
    expect(getByRole("row", { name: "Your libraries" })).toHaveAttribute("data-current-ancestor", "true");
    cleanup();

    // Expanded parent whose descendant is current.
    ({ getByTestId, getByRole } = renderIt(() => <Example selectedRoute="/projects-1" defaultExpandedKeys={["libraries"]} />));
    expect(getByTestId("anc")).toHaveTextContent("true");
    expect(getByRole("row", { name: "Your libraries" })).toHaveAttribute("data-current-ancestor", "true");
    cleanup();

    // Parent itself current, not an ancestor of itself.
    ({ getByTestId, getByRole } = renderIt(() => <Example selectedRoute="/libraries" />));
    expect(getByTestId("anc")).toHaveTextContent("false");
    expect(getByRole("row", { name: "Your libraries" })).not.toHaveAttribute("data-current-ancestor");
  });

  it("expands/collapses with ArrowRight/ArrowLeft on the link", async () => {
    const { getByRole, queryByRole } = renderIt(() => <NavigationTreeExample />);
    const librariesRow = getByRole("row", { name: "Your libraries" });
    await user.tab();
    await frame();
    await user.keyboard("{ArrowDown}");
    await frame();
    expect(getByRole("link", { name: "Your libraries" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(librariesRow).toHaveAttribute("aria-expanded", "true");
    expect(getByRole("link", { name: "Projects 1" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(librariesRow).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("link", { name: "Projects 1" })).toBeNull();
  });

  it("takes one tab to leave the NavigationTree from a link", async () => {
    const { getByRole } = renderIt(() => (
      <>
        <NavigationTreeExample selectedRoute="/files" />
        <input type="text" />
      </>
    ));
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Your files" })).toHaveFocus();
    await user.tab();
    expect(getByRole("textbox")).toHaveFocus();
  });

  it("takes one shift+tab to leave the NavigationTree from a link", async () => {
    const { getByRole } = renderIt(() => (
      <>
        <input type="text" />
        <NavigationTreeExample selectedRoute="/files" />
      </>
    ));
    await user.tab();
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Your files" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(getByRole("textbox")).toHaveFocus();
  });

  it("keeps focus on the row (not a secondary action) for an item with no href/link", async () => {
    const { getByRole } = renderIt(() => <NoLinkActionMenuNavigationTreeExample />);
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Your files" })).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    await frame();

    // Focus stays on the row itself; it does not jump into the secondary-action button.
    const sectionRow = getByRole("row", { name: "Section" });
    expect(sectionRow).toHaveFocus();
    expect(within(sectionRow).getByRole("button", { name: "More actions" })).not.toHaveFocus();
  });

  it("toggles expansion when pressing the label (a no-href Link) of a parent row", async () => {
    const { getByRole } = renderIt(() => <NoHrefLinkNavigationTreeExample />);
    const sectionRow = getByRole("row", { name: "Section" });
    expect(sectionRow).toHaveAttribute("aria-expanded", "false");

    await user.click(within(sectionRow).getByRole("link", { name: "Section" }));
    expect(sectionRow).toHaveAttribute("aria-expanded", "true");

    await user.click(within(sectionRow).getByRole("link", { name: "Section" }));
    expect(sectionRow).toHaveAttribute("aria-expanded", "false");
  });

  it("arrow left from a deep leaf steps to parent, collapses it, then moves to the grandparent", async () => {
    const { getByRole, queryByRole } = renderIt(() => (
      <ThreeLevelNavigationTreeExample defaultExpandedKeys={["libraries", "projects-1"]} selectedRoute="/projects-1A" />
    ));
    await user.tab();
    await frame();
    expect(getByRole("link", { name: "Projects 1A" })).toHaveFocus();

    // 1st ArrowLeft: leaf has nothing to collapse, so focus moves up to its parent.
    await user.keyboard("{ArrowLeft}");
    await frame();
    expect(getByRole("link", { name: "Projects 1" })).toHaveFocus();
    expect(getByRole("row", { name: "Projects 1" })).toHaveAttribute("aria-expanded", "true");

    // 2nd ArrowLeft: the parent is expanded, so it collapses; focus stays on it.
    await user.keyboard("{ArrowLeft}");
    await frame();
    expect(getByRole("row", { name: "Projects 1" })).toHaveAttribute("aria-expanded", "false");
    expect(queryByRole("link", { name: "Projects 1A" })).toBeNull();
    expect(getByRole("link", { name: "Projects 1" })).toHaveFocus();

    // 3rd ArrowLeft: focus moves up to the grandparent.
    await user.keyboard("{ArrowLeft}");
    await frame();
    expect(getByRole("link", { name: "Your libraries" })).toHaveFocus();
  });

  it("should render a NavigationTree with default classes, including sections and headers", () => {
    const { getByRole, getAllByRole } = renderIt(() => <SectionNavigationTreeExample />);
    expect(getByRole("treegrid")).toHaveClass("rv-NavigationTree");

    const rows = getAllByRole("row");
    // The header is also exposed with role="row", but it gets 'rv-NavigationTreeHeader'
    // instead of 'rv-NavigationTreeItem', so it is excluded from this loop.
    const itemRows = rows.filter((row) => !row.classList.contains("rv-NavigationTreeHeader"));
    expect(itemRows).toHaveLength(2);
    for (const row of itemRows) expect(row).toHaveClass("rv-NavigationTreeItem");

    const groups = getAllByRole("rowgroup");
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveClass("rv-NavigationTreeSection");
    expect(groups[1]).toHaveClass("rv-NavigationTreeSection");

    const header = rows[1]!;
    expect(header).toHaveClass("rv-NavigationTreeHeader");
    expect(within(header).getByRole("rowheader")).toHaveTextContent("Section 2");
  });

  it("should support custom classes on NavigationTree and NavigationTreeItem", () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s" class="test-NavigationTree">
        <NavigationTreeItem id="files" href="/files" textValue="Your files" class="test-row">
          <NavigationTreeItemContent>
            <Link>Your files</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(getByRole("treegrid")).toHaveClass("test-NavigationTree");
    expect(getByRole("row")).toHaveClass("test-row");
  });

  it("should support DOM props on NavigationTree and NavigationTreeItem", () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s" data-testid="test-NavigationTree">
        <NavigationTreeItem id="files" href="/files" textValue="Your files" data-testid="test-row">
          <NavigationTreeItemContent>
            <Link>Your files</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(getByRole("treegrid")).toHaveAttribute("data-testid", "test-NavigationTree");
    expect(getByRole("row")).toHaveAttribute("data-testid", "test-row");
  });

  it("should support style on NavigationTree", () => {
    const { getByRole } = renderIt(() => <NavigationTreeExample style={{ width: "200px" }} />);
    expect(getByRole("treegrid")).toHaveAttribute("style", expect.stringContaining("width: 200px"));
  });

  it("should have the base set of data attributes", () => {
    const { getByRole, getAllByRole } = renderIt(() => <NavigationTreeExample />);
    const tree = getByRole("treegrid");
    expect(tree).not.toHaveAttribute("data-empty");
    expect(tree).not.toHaveAttribute("data-focused");
    expect(tree).not.toHaveAttribute("data-focus-visible");

    for (const row of getAllByRole("row")) {
      expect(row).toHaveAttribute("data-level");
      expect(row).not.toHaveAttribute("data-selected");
      expect(row).not.toHaveAttribute("data-disabled");
      expect(row).not.toHaveAttribute("data-hovered");
      expect(row).not.toHaveAttribute("data-focused");
      expect(row).not.toHaveAttribute("data-focus-visible");
      expect(row).not.toHaveAttribute("data-pressed");
      expect(row).not.toHaveAttribute("data-selection-mode");
      expect(row).not.toHaveAttribute("data-current");
    }
  });

  it("should set data-current, data-expanded, data-has-child-items, data-level, and data-current-ancestor", () => {
    const { getByRole } = renderIt(() => <ThreeLevelNavigationTreeExample defaultExpandedKeys={["libraries", "projects-1"]} selectedRoute="/projects-1" />);
    const filesRow = getByRole("row", { name: "Your files" });
    const librariesRow = getByRole("row", { name: "Your libraries" });
    const projects1Row = getByRole("row", { name: "Projects 1" });
    const projects1ARow = getByRole("row", { name: "Projects 1A" });

    expect(projects1Row).toHaveAttribute("data-current", "true");
    expect(filesRow).not.toHaveAttribute("data-current");
    expect(librariesRow).not.toHaveAttribute("data-current");
    expect(projects1ARow).not.toHaveAttribute("data-current");

    expect(librariesRow).toHaveAttribute("data-expanded", "true");
    expect(librariesRow).toHaveAttribute("data-has-child-items", "true");
    expect(projects1Row).toHaveAttribute("data-expanded", "true");
    expect(projects1Row).toHaveAttribute("data-has-child-items", "true");
    expect(projects1ARow).not.toHaveAttribute("data-expanded");
    expect(projects1ARow).not.toHaveAttribute("data-has-child-items");

    expect(filesRow).toHaveAttribute("data-level", "1");
    expect(librariesRow).toHaveAttribute("data-level", "1");
    expect(projects1Row).toHaveAttribute("data-level", "2");
    expect(projects1ARow).toHaveAttribute("data-level", "3");

    expect(librariesRow).toHaveAttribute("data-current-ancestor", "true");
    expect(filesRow).not.toHaveAttribute("data-current-ancestor");
    expect(projects1Row).not.toHaveAttribute("data-current-ancestor");
    expect(projects1ARow).not.toHaveAttribute("data-current-ancestor");
  });

  it("sets data-focus-visible (and isFocusVisible) on the row for the link, not other children", async () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s" selectedRoute="/files">
        <NavigationTreeItem id="files" href="/files" textValue="Your files" class={({ isFocusVisible }: any) => (isFocusVisible() ? "ring" : "no-ring")}>
          <NavigationTreeItemContent>
            <Link>Your files</Link>
            <Button>Other</Button>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    const row = getByRole("row", { name: /Your files/ });
    const link = getByRole("link", { name: "Your files" });
    const other = getByRole("button", { name: "Other" });

    expect(row).not.toHaveAttribute("data-focus-visible");

    await user.tab();
    await frame();
    expect(link).toHaveFocus();
    expect(row).toHaveAttribute("data-focus-visible", "true");
    expect(row).toHaveClass("ring");

    // Tabbing to the other button keeps focus within the row, but focus-visible does not follow it.
    await user.tab();
    expect(other).toHaveFocus();
    expect(row).not.toHaveAttribute("data-focus-visible");
    expect(row).toHaveClass("no-ring");
  });

  it("exposes isCurrent on the NavigationTreeItem className render props", () => {
    const { getByRole } = renderIt(() => (
      <NavigationTree aria-label="s" selectedRoute="/files">
        <NavigationTreeItem id="files" href="/files" textValue="Your files" class={({ isCurrent }: any) => (isCurrent() ? "current" : "not-current")}>
          <NavigationTreeItemContent>
            <Link>Your files</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
        <NavigationTreeItem
          id="libraries"
          href="/libraries"
          textValue="Your libraries"
          class={({ isCurrent }: any) => (isCurrent() ? "current" : "not-current")}
        >
          <NavigationTreeItemContent>
            <Link>Your libraries</Link>
          </NavigationTreeItemContent>
        </NavigationTreeItem>
      </NavigationTree>
    ));
    expect(getByRole("row", { name: "Your files" })).toHaveClass("current");
    expect(getByRole("row", { name: "Your files" })).toHaveAttribute("data-current", "true");
    expect(getByRole("row", { name: "Your libraries" })).toHaveClass("not-current");
    expect(getByRole("row", { name: "Your libraries" })).not.toHaveAttribute("data-current");
  });
});
