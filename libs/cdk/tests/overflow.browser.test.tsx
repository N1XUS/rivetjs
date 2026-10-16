// Ported from React Spectrum v3 test/breadcrumbs/Breadcrumbs.test.js (collapsing cases) and test/actiongroup/ActionGroup.test.js
// (`overflowMode="collapse"` cases), react-spectrum, Apache-2.0, © Adobe.
// Changes: Chromium (`@rivetjs/runtime/testing`) instead of jsdom + jest fake timers: the ResizeObserver callback measures,
// so each case awaits two frames (`settle`); `offsetWidth` / `getBoundingClientRect` mocked on the prototypes as upstream
// (`HTMLUListElement` → `HTMLOListElement`: RAC Breadcrumbs is an `<ol>`); Spectrum's built-in folder menu → the
// `renderOverflow` render prop (a cdk MenuTrigger of the collapsed items: Spectrum v3 lists every item with the current
// one checked, S2 / Rivet list the collapsed ones); ActionGroup items → buttons of a `createOverflow({ collapse: "end" })`.
// Not ported: Spectrum styling cases (size, UNSAFE_className), RouterProvider, ActionGroup selection / buttonLabelBehavior /
// focus management (not overflow logic).
// Rivet additions: real-layout resize (no mocks), items change, maxVisibleItems, defaultVisibleItems, flex gap, isDisabled.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { For, ref as createRef } from "@rivetjs/runtime/dom";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Breadcrumb, Breadcrumbs, type BreadcrumbsOverflowItem, type BreadcrumbsProps, type Key } from "../breadcrumbs/index.tsx";
import { Link } from "../link/index.tsx";
import { Button } from "../button/index.tsx";
import { Popover } from "../popover/index.tsx";
import { Menu, MenuItem, MenuTrigger } from "../menu/index.tsx";
import { OVERFLOW, createOverflow, overflowSlices } from "../overflow/index.tsx";

const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

function renderUI(ui: () => unknown) {
  const { container } = render(ui as never);
  return within(container as HTMLElement);
}

const spies: { mockRestore(): void }[] = [];
afterEach(() => {
  cleanup();
  while (spies.length) spies.pop()!.mockRestore();
});

/** Spectrum's `jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get')`. */
function mockOffsetWidth(fn: (el: HTMLElement) => number) {
  spies.push(
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      return fn(this);
    }),
  );
}

const listWidth = (width: number) => mockOffsetWidth((el) => (el instanceof HTMLOListElement ? width : 100));

/** Spectrum's folder menu, as a render prop: a "…" MenuTrigger listing the collapsed breadcrumbs. */
const folderMenu = (onAction?: (key: Key) => void) => (items: BreadcrumbsOverflowItem[]) => (
  <MenuTrigger>
    <Button aria-label="…">…</Button>
    <Popover>
      <Menu items={items} onAction={onAction}>
        {(item: BreadcrumbsOverflowItem) => (
          <MenuItem id={item.key} href={item.href} textValue={item.textValue}>
            {item.textValue}
          </MenuItem>
        )}
      </Menu>
    </Popover>
  </MenuTrigger>
);

function Folders(props: Partial<BreadcrumbsProps<unknown>> & { count?: number; hrefs?: boolean }) {
  const { count = 5, hrefs, ...rest } = props;
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  return (
    <Breadcrumbs overflowMode="collapse" renderOverflow={folderMenu(rest.onAction)} {...rest}>
      {ids.map((n) => (
        <Breadcrumb id={`Folder ${n}`}>
          <Link href={hrefs ? `#/folder-${n}` : undefined}>{`Folder ${n}`}</Link>
        </Breadcrumb>
      ))}
    </Breadcrumbs>
  );
}

describe("Breadcrumbs overflowMode=collapse (Spectrum Breadcrumbs.test.js)", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });
  beforeEach(() => listWidth(500));

  it("shows four items with no menu", async () => {
    const { getByText, getByRole } = renderUI(() => <Folders count={4} />);
    await settle();
    const { children } = getByRole("list");
    expect(within(children[0] as HTMLElement).queryByRole("button")).toBeNull();
    for (const n of [1, 2, 3, 4]) expect(getByText(`Folder ${n}`)).toBeTruthy();
  });

  it("shows a maximum of 4 items", async () => {
    const { queryByText, getByText, getByRole } = renderUI(() => <Folders />);
    await settle();
    const { children } = getByRole("list");
    expect(within(children[0] as HTMLElement).getByRole("button")).toBeTruthy();
    expect(queryByText("Folder 1")).toBeNull();
    expect(queryByText("Folder 2")).toBeNull();
    expect(getByText("Folder 3")).toBeTruthy();
    expect(getByText("Folder 4")).toBeTruthy();
    expect(getByText("Folder 5")).toBeTruthy();
  });

  it("shows a maximum of 4 items with showRoot", async () => {
    const { queryByText, getByText, getByRole } = renderUI(() => <Folders showRoot />);
    await settle();
    const { children } = getByRole("list");
    expect(getByText("Folder 1")).toBeTruthy();
    expect(within(children[1] as HTMLElement).getByRole("button")).toBeTruthy();
    expect(queryByText("Folder 2")).toBeNull();
    expect(queryByText("Folder 3")).toBeNull();
    expect(getByText("Folder 4")).toBeTruthy();
    expect(getByText("Folder 5")).toBeTruthy();
  });

  it("Handles single item and showRoot", async () => {
    const { getByText } = renderUI(() => <Folders count={1} showRoot />);
    await settle();
    const item = getByText("Folder 1");
    expect(item).toBeTruthy();
    expect(item).toHaveAttribute("aria-current", "page");
  });

  it("shows less than 4 items if they do not fit", async () => {
    listWidth(300);
    const { queryByText, getByText, getByRole } = renderUI(() => <Folders />);
    await settle();
    const { children } = getByRole("list");
    expect(within(children[0] as HTMLElement).getByRole("button")).toBeTruthy();
    for (const n of [1, 2, 3, 4]) expect(queryByText(`Folder ${n}`)).toBeNull();
    expect(getByText("Folder 5")).toBeTruthy();
  });

  it("collapses root item if it does not fit", async () => {
    listWidth(300);
    const { queryByText, getByText, getByRole } = renderUI(() => <Folders showRoot />);
    await settle();
    const { children } = getByRole("list");
    expect(queryByText("Folder 1")).toBeNull();
    expect(within(children[0] as HTMLElement).getByRole("button")).toBeTruthy();
    for (const n of [2, 3, 4]) expect(queryByText(`Folder ${n}`)).toBeNull();
    expect(getByText("Folder 5")).toBeTruthy();
  });

  it("Handles showRoot and folders of different widths", async () => {
    // Change the width of "Folder 1" from 100px to 200px, which means there's only room for 1 other breadcrumb.
    mockOffsetWidth((el) => (el instanceof HTMLOListElement ? 500 : el.textContent === "Folder 1" ? 200 : 100));
    const { queryByText, getByText, getByRole } = renderUI(() => <Folders showRoot />);
    await settle();
    const { children } = getByRole("list");
    expect(within(children[1] as HTMLElement).getByRole("button")).toBeTruthy();
    expect(getByText("Folder 1")).toBeTruthy();
    for (const n of [2, 3, 4]) expect(queryByText(`Folder ${n}`)).toBeNull();
    expect(getByText("Folder 5")).toBeTruthy();
  });

  it("can open the menu", async () => {
    const onAction = vi.fn();
    const { getByRole, getAllByText } = renderUI(() => <Folders showRoot onAction={onAction} />);
    await settle();
    await user.click(getByRole("button"));
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu).toBeTruthy();
    // Rivet / S2: the menu lists the collapsed breadcrumbs (Spectrum v3: every breadcrumb).
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Folder 2", "Folder 3"]);
    // breadcrumb root item
    const root = getAllByText("Folder 1")[0];
    expect(root).toHaveAttribute("role", "link");
    await user.click(items[1]);
    expect(onAction).toHaveBeenCalledWith("Folder 3");
  });

  it("the current folder is never collapsed (Spectrum: clicking it in the menu does not trigger onAction)", async () => {
    listWidth(150);
    let seen: BreadcrumbsOverflowItem[] = [];
    renderUI(() => (
      <Folders
        renderOverflow={(items) => {
          seen = items;
          return <span>…</span>;
        }}
      />
    ));
    await settle();
    expect(seen.map((i) => i.key)).toEqual(["Folder 1", "Folder 2", "Folder 3", "Folder 4"]);
    expect(document.querySelector('[aria-current="page"]')).toHaveTextContent("Folder 5");
  });

  it("should support links", async () => {
    const { getAllByRole, getByRole } = renderUI(() => <Folders hrefs />);
    await settle();
    const links = getAllByRole("link").filter((l) => l.tagName === "A");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "#/folder-3");
    expect(links[1]).toHaveAttribute("href", "#/folder-4");
    await user.click(getByRole("button"));
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    expect(items[0].tagName).toBe("A");
    // The collapsed breadcrumb's href, read from its link while every breadcrumb was shown.
    expect(items[0]).toHaveAttribute("href", "#/folder-1");
  });

  it("Handles isDisabled (the overflow trigger stays a plain render prop)", async () => {
    const { getAllByRole } = renderUI(() => <Folders isDisabled />);
    await settle();
    for (const link of getAllByRole("link")) expect(link).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Breadcrumbs overflowMode=collapse (Rivet)", () => {
  it("overflowMode='wrap' (default) never measures", async () => {
    listWidth(150);
    const { getAllByRole } = renderUI(() => (
      <Breadcrumbs>
        {[1, 2, 3, 4, 5].map((n) => (
          <Breadcrumb>
            <Link>{`Folder ${n}`}</Link>
          </Breadcrumb>
        ))}
      </Breadcrumbs>
    ));
    await settle();
    expect(getAllByRole("listitem")).toHaveLength(5);
  });

  it("maxVisibleItems: a number caps, 'auto' keeps every item that fits", async () => {
    listWidth(1000);
    const a = renderUI(() => <Folders count={6} maxVisibleItems={3} />);
    await settle();
    expect(a.getAllByRole("listitem")).toHaveLength(3); // menu + Folder 5, Folder 6
    cleanup();
    const b = renderUI(() => <Folders count={6} maxVisibleItems="auto" />);
    await settle();
    expect(b.getAllByRole("listitem")).toHaveLength(6);
    expect(b.queryByRole("button")).toBeNull();
  });

  it("defaultVisibleItems renders collapsed before measuring, then measures", async () => {
    listWidth(1000);
    const { getAllByRole, getByRole } = renderUI(() => <Folders count={4} defaultVisibleItems={2} />);
    // Before the first measurement: overflow item + the last breadcrumb (+ 1).
    expect(getByRole("list").children).toHaveLength(3);
    await settle();
    expect(getAllByRole("listitem")).toHaveLength(4);
  });

  it("textValue + data-overflow + overflowClass", async () => {
    listWidth(300);
    let seen: BreadcrumbsOverflowItem[] = [];
    const { getByRole } = renderUI(() => (
      <Breadcrumbs
        overflowMode="collapse"
        overflowClass="more"
        renderOverflow={(items) => {
          seen = items;
          return <span>…</span>;
        }}
      >
        <Breadcrumb id="a" textValue="Alpha">
          <Link>A</Link>
        </Breadcrumb>
        <Breadcrumb id="b">
          <Link>Beta</Link>
        </Breadcrumb>
        <Breadcrumb id="c">
          <Link>Gamma</Link>
        </Breadcrumb>
        <Breadcrumb id="d">
          <Link>Delta</Link>
        </Breadcrumb>
      </Breadcrumbs>
    ));
    await settle();
    const more = getByRole("list").children[0] as HTMLElement;
    expect(more).toHaveClass("more");
    expect(more).toHaveAttribute("data-overflow", "true");
    expect(seen.map((i) => i.textValue)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("re-measures when the container resizes (real layout)", async () => {
    const width = signal(1000);
    const { getByRole } = renderUI(() => (
      <div style={{ width: `${width()}px` }}>
        <Breadcrumbs
          overflowMode="collapse"
          maxVisibleItems="auto"
          style={{ display: "flex", gap: "8px", margin: "0", padding: "0", "list-style": "none" }}
          renderOverflow={() => <span style={{ display: "block", width: "40px" }}>…</span>}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Breadcrumb style={{ "flex-shrink": "0", width: "100px", overflow: "hidden" }}>
              <Link>{`Folder ${n}`}</Link>
            </Breadcrumb>
          ))}
        </Breadcrumbs>
      </div>
    ));
    await settle();
    const list = getByRole("list");
    expect(list.children).toHaveLength(6);
    width.set(400);
    await settle();
    // 400px: overflow (40 + 8) + last 100 + 2 × (100 + 8) = 364 < 400; a third would be 472.
    expect(list.children).toHaveLength(4);
    expect(list.children[0]).toHaveAttribute("data-overflow", "true");
    expect(list.lastElementChild).toHaveTextContent("Folder 6");
    width.set(1000);
    await settle();
    expect(list.children).toHaveLength(6);
  });

  it("re-measures when items change", async () => {
    listWidth(500);
    const items = signal([1, 2, 3]);
    const { getByRole } = renderUI(() => (
      <Breadcrumbs overflowMode="collapse" items={() => items().map((id) => ({ id }))} renderOverflow={() => <span>…</span>}>
        {(item: { id: number }) => (
          <Breadcrumb id={item.id}>
            <Link>{`Folder ${item.id}`}</Link>
          </Breadcrumb>
        )}
      </Breadcrumbs>
    ));
    await settle();
    expect(getByRole("list").children).toHaveLength(3);
    items.set([1, 2, 3, 4, 5, 6]);
    await settle();
    const list = getByRole("list");
    expect(list.children[0]).toHaveAttribute("data-overflow", "true");
    expect(list.children).toHaveLength(4);
    expect(list.lastElementChild).toHaveTextContent("Folder 6");
  });
});

describe('createOverflow collapse="end" (Spectrum ActionGroup.test.js overflowMode="collapse")', () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });
  const mockRects = (container: number) =>
    spies.push(
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const width = this instanceof HTMLButtonElement ? 100 : container;
        return { width, height: 0, top: 0, left: 0, bottom: 0, right: width, x: 0, y: 0, toJSON() {} } as DOMRect;
      }),
    );

  function Group(props: { onAction?: (key: unknown) => void; isDisabled?: boolean }) {
    const el = createRef<HTMLDivElement>();
    const keys = ["one", "two", "three", "four"];
    const label = (k: string) => k[0].toUpperCase() + k.slice(1);
    const overflow = createOverflow({ ref: el, items: () => keys, collapse: "end", isDisabled: props.isDisabled });
    return (
      <div ref={el} role="toolbar">
        <For each={overflow.items} by={(k: string) => k}>
          {(k: () => string) =>
            k() === OVERFLOW ? (
              <MenuTrigger>
                <Button aria-label="More items">…</Button>
                <Popover>
                  <Menu items={overflow.hidden().map((id) => ({ id }))} onAction={props.onAction}>
                    {(item: { id: string }) => <MenuItem id={item.id}>{label(item.id)}</MenuItem>}
                  </Menu>
                </Popover>
              </MenuTrigger>
            ) : (
              <button type="button" onClick={() => props.onAction?.(k())}>
                {label(k())}
              </button>
            )
          }
        </For>
      </div>
    );
  }

  it("collapses overflowing items into a menu", async () => {
    mockRects(250);
    const onAction = vi.fn();
    const { getByRole } = renderUI(() => <Group onAction={onAction} />);
    await settle();
    const buttons = within(getByRole("toolbar")).getAllByRole("button");
    expect(buttons.length).toBe(2);
    expect(buttons[0]).toHaveTextContent("One");
    expect(buttons[1]).toHaveAttribute("aria-label", "More items");
    expect(buttons[1]).toHaveAttribute("aria-haspopup", "true");
    await user.click(buttons[1]);
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    const items = within(menu).getAllByRole("menuitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Two");
    expect(items[1]).toHaveTextContent("Three");
    expect(items[2]).toHaveTextContent("Four");
    await user.click(items[1]);
    expect(onAction).toHaveBeenCalledWith("three");
  });

  it("collapses every item when only the menu fits", async () => {
    mockRects(150);
    const { getByRole } = renderUI(() => <Group />);
    await settle();
    const buttons = within(getByRole("toolbar")).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute("aria-label", "More items");
  });

  it("isDisabled (overflowMode='wrap'): every item, no measuring", async () => {
    mockRects(150);
    const { getByRole } = renderUI(() => <Group isDisabled />);
    await settle();
    expect(within(getByRole("toolbar")).getAllByRole("button")).toHaveLength(4);
  });
});

describe("createOverflow ResizeObserver re-fire (container size follows its content)", () => {
  // The docs example `overflow-toolbar`: a resizable wrapper, a `flex` toolbar whose height follows its content. The measurement's
  // own writes (show all, collapse) change the toolbar's height, so the observer fires again with an unchanged width.
  function Group(props: { width: () => number; measures?: { count: number } }) {
    const el = createRef<HTMLDivElement>();
    const keys = ["one", "two", "three", "four", "five", "six"];
    const overflow = createOverflow({
      ref: el,
      items: () => keys,
      collapse: "end",
      onMeasureAll: () => void (props.measures && props.measures.count++),
    });
    return (
      <div style={{ width: `${props.width()}px` }}>
        <div ref={el} role="toolbar" style={{ display: "flex", gap: "4px" }}>
          <For each={overflow.items} by={(k: string) => k}>
            {(k: () => string) =>
              k() === OVERFLOW ? (
                <button type="button" aria-label="More items" style={{ width: "40px", height: "60px", "flex-shrink": "0" }}>
                  …
                </button>
              ) : (
                <button type="button" style={{ width: "100px", height: "20px", "flex-shrink": "0" }}>
                  {k()}
                </button>
              )
            }
          </For>
        </div>
      </div>
    );
  }

  it("resizing reports no ResizeObserver loop error and ends with the right count", async () => {
    const errors: string[] = [];
    const onError = (event: ErrorEvent) => void errors.push(event.message);
    window.addEventListener("error", onError);
    try {
      const width = signal(1000);
      const measures = { count: 0 };
      const { getByRole } = renderUI(() => <Group width={width} measures={measures} />);
      await settle();
      const toolbar = getByRole("toolbar");
      expect(within(toolbar).getAllByRole("button")).toHaveLength(6);
      for (const next of [350, 560, 250, 1000, 480]) {
        width.set(next);
        await settle();
        await settle();
      }
      // 480px: n x 100 + (n - 1) x 4 + 4 + 40 <= 480 -> 4 items + the "More" button.
      expect(within(toolbar).getAllByRole("button")).toHaveLength(5);
      expect(within(toolbar).getByLabelText("More items")).toBeInTheDocument();
      expect(errors.filter((message) => /ResizeObserver/.test(message))).toEqual([]);
    } finally {
      window.removeEventListener("error", onError);
    }
  });

  it("measures once per width change, not again for the re-fire of its own layout write", async () => {
    const width = signal(1000);
    const measures = { count: 0 };
    renderUI(() => <Group width={width} measures={measures} />);
    await settle();
    await settle();
    // The first ResizeObserver callback and `document.fonts.ready` measure; the re-fire of those writes does not.
    const first = measures.count;
    expect(first).toBeLessThanOrEqual(2);
    await settle();
    expect(measures.count).toBe(first);
    width.set(400);
    await settle();
    await settle();
    expect(measures.count).toBe(first + 1);
  });
});

describe("overflowSlices", () => {
  const items = [1, 2, 3, 4, 5];
  it("start: [root?, menu, ...last]", () => {
    expect(overflowSlices(items, 3, { collapse: "start" })).toEqual({ before: [], hidden: [1, 2], after: [3, 4, 5] });
    expect(overflowSlices(items, 3, { collapse: "start", showRoot: true })).toEqual({ before: [1], hidden: [2, 3], after: [4, 5] });
    // showRoot with one visible item: the root collapses too (Spectrum `showRoot && visibleItems > 1`).
    expect(overflowSlices(items, 1, { collapse: "start", showRoot: true })).toEqual({ before: [], hidden: [1, 2, 3, 4], after: [5] });
    expect(overflowSlices(items, 9, { collapse: "start" })).toEqual({ before: items, hidden: [], after: [] });
  });
  it("end: [...first, menu]", () => {
    expect(overflowSlices(items, 2, { collapse: "end" })).toEqual({ before: [1, 2], hidden: [3, 4, 5], after: [] });
    expect(overflowSlices(items, 0, { collapse: "end" })).toEqual({ before: [], hidden: items, after: [] });
  });
});
