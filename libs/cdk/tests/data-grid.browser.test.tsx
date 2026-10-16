// Rivet-authored tests of `@rivetjs/cdk/data-grid` (Chromium): ARIA grid structure, keyboard navigation (React Aria
// table semantics), selection, sorting, column resizing, pinned columns, tree rows, reordering, virtual scrolling,
// load more, empty state.
import { afterEach, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { userEvent } from "@testing-library/user-event";
import { DataGrid, type DataGridColumn, type Key, type Selection, type SortDescriptor } from "../data-grid/index.tsx";

interface Person {
  id: number;
  name: string;
  age: number;
  city: string;
  children?: Person[];
}

const people: Person[] = [
  { id: 1, name: "Charlie", age: 34, city: "Oslo" },
  { id: 2, name: "alice", age: 28, city: "Berlin" },
  { id: 3, name: "Bob", age: 45, city: "Austin" },
  { id: 4, name: "Dana", age: 22, city: "Lima" },
];

const columns: DataGridColumn<Person>[] = [
  { id: "name", header: "Name", accessorKey: "name", allowsSorting: true },
  { id: "age", header: "Age", accessorKey: "age", allowsSorting: true, align: "end" },
  { id: "city", header: "City", accessorKey: "city" },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const settle = async () => {
  flush();
  await frame();
  flush();
};

function mount(fn: () => unknown) {
  const result = render(fn as never);
  const container = result.container as HTMLElement;
  const grid = () => container.querySelector<HTMLTableElement>("table")!;
  const rows = () => [...container.querySelectorAll<HTMLTableRowElement>("tbody > tr[data-key]")];
  const names = () => rows().map((r) => r.querySelector("[data-column=name]")!.textContent);
  return { container, grid, rows, names };
}

afterEach(() => cleanup());

describe("DataGrid structure", () => {
  it("renders an ARIA grid with header, row headers and cells", () => {
    const { grid, rows } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} />);
    expect(grid()).toHaveAttribute("role", "grid");
    expect(grid()).toHaveAttribute("aria-label", "People");
    expect(grid()).toHaveAttribute("aria-rowcount", "5");
    expect(grid()).toHaveAttribute("aria-colcount", "3");
    const headers = [...grid().querySelectorAll("thead th")];
    expect(headers.map((h) => h.getAttribute("role"))).toEqual(["columnheader", "columnheader", "columnheader"]);
    expect(headers[0]).toHaveAttribute("aria-sort", "none");
    expect(headers[2]).not.toHaveAttribute("aria-sort");
    expect(rows()).toHaveLength(4);
    expect(rows()[0]).toHaveAttribute("aria-rowindex", "2");
    const first = rows()[0]!;
    expect(first.children[0]).toHaveAttribute("role", "rowheader");
    expect(first.children[1]).toHaveAttribute("role", "gridcell");
    expect(first.children[1]).toHaveTextContent("34");
    expect((first.children[1] as HTMLElement).style.textAlign).toBe("end");
    expect(grid()).toHaveAttribute("tabindex", "0");
    expect(first).toHaveAttribute("tabindex", "-1");
  });

  it("renders custom cells and function headers with the sort state", async () => {
    const cols: DataGridColumn<Person>[] = [
      { id: "name", header: ({ sortDirection }) => <span class="h">Name {sortDirection() ?? "unsorted"}</span>, accessorKey: "name", allowsSorting: true },
      { id: "badge", header: "Badge", cell: (p) => <b class="badge">{p.name.toUpperCase()}</b> },
    ];
    const { grid, rows } = mount(() => <DataGrid aria-label="People" data={people} columns={cols} />);
    expect(rows()[0]!.querySelector(".badge")).toHaveTextContent("CHARLIE");
    expect(grid().querySelector(".h")).toHaveTextContent("Name unsorted");
    (grid().querySelector("thead [data-column=name]") as HTMLElement).click();
    await settle();
    expect(grid().querySelector(".h")).toHaveTextContent("Name ascending");
  });

  it("shows the empty state", () => {
    const { container } = mount(() => <DataGrid aria-label="People" data={[]} columns={columns} renderEmptyState={() => <p class="empty">No people</p>} />);
    expect(container.querySelector(".empty")).toHaveTextContent("No people");
    expect(container.querySelector("tbody td")).toHaveAttribute("colspan", "3");
  });

  it("renders the footer outside the scroll container", () => {
    const { container } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} footer={<span class="foot">4 people</span>} />);
    const foot = container.querySelector(".foot")!;
    expect(foot.closest(".rv-DataGrid-scroll")).toBeNull();
    expect(foot.closest(".rv-DataGrid-footer")).not.toBeNull();
  });
});

describe("DataGrid sorting", () => {
  it("sorts on the client (locale-aware), toggling direction", async () => {
    const onSortChange = vi.fn();
    const { grid, names } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} onSortChange={onSortChange} />);
    const nameHeader = grid().querySelector<HTMLElement>("thead [data-column=name]")!;
    nameHeader.click();
    await settle();
    expect(names()).toEqual(["alice", "Bob", "Charlie", "Dana"]);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    expect(onSortChange).toHaveBeenLastCalledWith({ column: "name", direction: "ascending" });
    nameHeader.click();
    await settle();
    expect(names()).toEqual(["Dana", "Charlie", "Bob", "alice"]);
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");
  });

  it("keeps row elements when sorting (keyed rows)", async () => {
    const { grid, rows } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} />);
    const before = new Map(rows().map((r) => [r.dataset.key, r]));
    grid().querySelector<HTMLElement>("thead [data-column=age]")!.click();
    await settle();
    for (const r of rows()) expect(before.get(r.dataset.key)).toBe(r);
    expect(rows().map((r) => r.dataset.key)).toEqual(["4", "2", "1", "3"]);
  });

  it("uses a custom sortFn", async () => {
    const cols: DataGridColumn<Person>[] = [
      { id: "name", header: "Name", accessorKey: "name", allowsSorting: true, sortFn: (a, b) => a.name.length - b.name.length },
    ];
    const { grid, names } = mount(() => (
      <DataGrid aria-label="People" data={people} columns={cols} defaultSortDescriptor={{ column: "name", direction: "ascending" }} />
    ));
    expect(names()).toEqual(["Bob", "Dana", "alice", "Charlie"]);
    grid().querySelector<HTMLElement>("thead [data-column=name]")!.click();
    await settle();
    expect(names()).toEqual(["Charlie", "alice", "Dana", "Bob"]);
  });

  it("controlled sortDescriptor does not sort the data (server-side)", async () => {
    const sort = signal<SortDescriptor | null>({ column: "age", direction: "ascending" });
    const { grid, names } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} sortDescriptor={sort} />);
    expect(names()).toEqual(["Charlie", "alice", "Bob", "Dana"]);
    expect(grid().querySelector("thead [data-column=age]")).toHaveAttribute("aria-sort", "ascending");
    grid().querySelector<HTMLElement>("thead [data-column=age]")!.click();
    await settle();
    expect(sort()).toEqual({ column: "age", direction: "descending" });
    expect(names()).toEqual(["Charlie", "alice", "Bob", "Dana"]);
  });

  it("sortMode client sorts a controlled descriptor", () => {
    const sort = signal<SortDescriptor | null>({ column: "age", direction: "descending" });
    const { names } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} sortDescriptor={sort} sortMode="client" />);
    expect(names()).toEqual(["Bob", "Charlie", "alice", "Dana"]);
  });
});

describe("DataGrid selection", () => {
  it("toggles rows by click and Space, checkboxes + select all", async () => {
    const selected = signal<Selection>(new Set());
    const { grid, rows } = mount(() => (
      <DataGrid aria-label="People" data={people} columns={columns} selectionMode="multiple" showSelectionCheckboxes selectedKeys={selected} />
    ));
    expect(grid()).toHaveAttribute("aria-multiselectable", "true");
    expect(grid()).toHaveAttribute("aria-colcount", "4");
    rows()[0]!.querySelector<HTMLElement>("[data-column=city]")!.click();
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([1]);
    expect(rows()[0]).toHaveAttribute("aria-selected", "true");
    expect(rows()[0]).toHaveAttribute("data-selected", "true");
    rows()[1]!.querySelector<HTMLElement>("[data-rv-select]")!.click();
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([1, 2]);
    const all = grid().querySelector<HTMLElement>("[data-rv-select-all]")!;
    expect(all).toHaveAttribute("aria-checked", "mixed");
    all.click();
    await settle();
    expect(selected()).toBe("all");
    expect(all).toHaveAttribute("aria-checked", "true");
    expect(rows().every((r) => r.getAttribute("aria-selected") === "true")).toBe(true);
    // Toggling one row out of "all" keeps the others.
    rows()[3]!.querySelector<HTMLElement>("[data-rv-select]")!.click();
    await settle();
    expect([...(selected() as Set<Key>)].sort()).toEqual([1, 2, 3]);
    all.click();
    await settle();
    expect(selected()).toBe("all");
    all.click();
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([]);
  });

  it("shift-click selects a range; Ctrl+A selects all; Escape clears", async () => {
    const selected = signal<Selection>(new Set());
    const user = userEvent.setup();
    const { rows } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} selectionMode="multiple" selectedKeys={selected} />);
    await user.click(rows()[0]!.children[2]!);
    await user.keyboard("{Shift>}");
    await user.click(rows()[2]!.children[2]!);
    await user.keyboard("{/Shift}");
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([1, 2, 3]);
    rows()[0]!.focus();
    await user.keyboard("{Escape}");
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([]);
    await user.keyboard("{Control>}a{/Control}");
    await settle();
    expect(selected()).toBe("all");
  });

  it("replace behaviour selects one row per click and moves the selection with the arrows", async () => {
    const selected = signal<Selection>(new Set());
    const user = userEvent.setup();
    const { rows } = mount(() => (
      <DataGrid aria-label="People" data={people} columns={columns} selectionMode="multiple" selectionBehavior="replace" selectedKeys={selected} />
    ));
    await user.click(rows()[0]!.children[2]!);
    await user.click(rows()[1]!.children[2]!);
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([2]);
    await user.keyboard("{ArrowDown}");
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([3]);
    // The click focused the cell (RA useGridCell), so the arrow moves to the cell below.
    expect(document.activeElement).toBe(rows()[2]!.children[2]);
  });

  it("single selection and disabled rows", async () => {
    const selected = signal<Selection>(new Set());
    const { rows } = mount(() => (
      <DataGrid aria-label="People" data={people} columns={columns} selectionMode="single" selectedKeys={selected} disabledKeys={[2]} />
    ));
    rows()[0]!.click();
    await settle();
    rows()[2]!.click();
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([3]);
    rows()[1]!.click();
    await settle();
    expect([...(selected() as Set<Key>)]).toEqual([3]);
    expect(rows()[1]).toHaveAttribute("aria-disabled", "true");
  });

  it("onRowAction: click runs the action when nothing is selected, Enter always", async () => {
    const onRowAction = vi.fn();
    const user = userEvent.setup();
    const { rows } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} onRowAction={onRowAction} />);
    await user.click(rows()[1]!.children[1]!);
    expect(onRowAction).toHaveBeenLastCalledWith(2);
    rows()[2]!.focus();
    await user.keyboard("{Enter}");
    expect(onRowAction).toHaveBeenLastCalledWith(3);
  });
});

describe("DataGrid keyboard navigation", () => {
  it("tabs into the grid, moves between rows, cells and headers", async () => {
    const user = userEvent.setup();
    const { grid, rows } = mount(() => (
      <>
        <button id="before">before</button>
        <DataGrid aria-label="People" data={people} columns={columns} />
      </>
    ));
    (document.getElementById("before") as HTMLElement).focus();
    await user.tab();
    expect(document.activeElement).toBe(rows()[0]);
    expect(grid()).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(rows()[1]!.children[0]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(rows()[1]!.children[1]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(rows()[1]!.children[2]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(rows()[1]!.children[2]);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(grid().querySelector("thead [data-column=city]"));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(grid().querySelector("thead [data-column=age]"));
    await user.keyboard("{Enter}");
    await settle();
    expect(grid().querySelector("thead [data-column=age]")).toHaveAttribute("aria-sort", "ascending");
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows()[0]!.children[1]);
    await user.keyboard("{Control>}{End}{/Control}");
    expect(document.activeElement).toBe(rows()[3]!.children[1]);
    await user.tab({ shift: true });
    await user.tab();
    expect(document.activeElement).toBe(rows()[3]!.children[1]);
  });

  it("typeahead focuses the next row whose row header starts with the typed text", async () => {
    const user = userEvent.setup();
    const { rows } = mount(() => <DataGrid aria-label="People" data={people} columns={columns} />);
    rows()[0]!.focus();
    await user.keyboard("d");
    expect(document.activeElement).toBe(rows()[3]);
    await wait(1100);
    await user.keyboard("al");
    expect(document.activeElement).toBe(rows()[1]);
  });

  it("editable cell content keeps arrow keys; Escape returns to the cell", async () => {
    const user = userEvent.setup();
    const cols: DataGridColumn<Person>[] = [
      { id: "name", header: "Name", accessorKey: "name" },
      { id: "edit", header: "Edit", cell: (p) => <input aria-label={`Edit ${p.name}`} value={p.city} /> },
    ];
    const { rows } = mount(() => <DataGrid aria-label="People" data={people} columns={cols} selectionMode="multiple" />);
    const input = rows()[0]!.querySelector("input")!;
    await user.click(input);
    await user.keyboard("{ArrowLeft}{ArrowDown}x");
    expect(document.activeElement).toBe(input);
    expect(input.value).toContain("x");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(rows()[0]!.children[1]);
    // Arrow right from the cell walks into its focusable child.
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(input);
  });
});

describe("DataGrid column resizing and pinning", () => {
  it("resizes a column with the pointer and the keyboard", async () => {
    const onColumnResize = vi.fn();
    const onColumnResizeEnd = vi.fn();
    const cols: DataGridColumn<Person>[] = [
      { id: "name", header: "Name", accessorKey: "name", width: 200, minWidth: 100, maxWidth: 300 },
      { id: "age", header: "Age", accessorKey: "age", width: 100 },
    ];
    const { grid } = mount(() => (
      <div style={{ width: "600px" }}>
        <DataGrid aria-label="People" data={people} columns={cols} allowsColumnResize onColumnResize={onColumnResize} onColumnResizeEnd={onColumnResizeEnd} />
      </div>
    ));
    expect(grid().style.width).toBe("300px");
    const resizer = grid().querySelector<HTMLElement>("[data-rv-resizer=name]")!;
    const box = resizer.getBoundingClientRect();
    const x = box.left + box.width / 2,
      y = box.top + box.height / 2;
    resizer.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x + 50, clientY: y, pointerId: 1 }));
    await settle();
    expect(grid().querySelector<HTMLElement>("thead [data-column=name]")!.getBoundingClientRect().width).toBeCloseTo(250, 0);
    expect(onColumnResize.mock.lastCall![0].get("name")).toBe(250);
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: x + 500, clientY: y, pointerId: 1 }));
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x + 500, clientY: y, pointerId: 1 }));
    await settle();
    expect(onColumnResizeEnd.mock.lastCall![0].get("name")).toBe(300);
    expect(grid().style.width).toBe("400px");
    expect(grid().querySelector("thead [data-column=name]")).not.toHaveAttribute("aria-sort");
    // Keyboard: header → ArrowRight focuses the resizer, arrows resize by 10 px.
    const user = userEvent.setup();
    grid().querySelector<HTMLElement>("thead [data-column=name]")!.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(resizer);
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    await settle();
    expect(resizer).toHaveAttribute("aria-valuenow", "280");
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(grid().querySelector("thead [data-column=name]"));
  });

  it("pins columns with sticky offsets and edge markers", async () => {
    const cols: DataGridColumn<Person>[] = [
      { id: "name", header: "Name", accessorKey: "name", width: 150, pinned: "start" },
      { id: "age", header: "Age", accessorKey: "age", width: 400 },
      { id: "city", header: "City", accessorKey: "city", width: 400 },
      { id: "end", header: "End", accessorKey: "city", width: 120, pinned: "end" },
    ];
    const { grid, container } = mount(() => (
      <div style={{ width: "500px" }}>
        <DataGrid aria-label="People" data={people} columns={cols} selectionMode="multiple" showSelectionCheckboxes />
      </div>
    ));
    const nameCell = grid().querySelector<HTMLElement>("tbody [data-column=name]")!;
    expect(nameCell.style.position).toBe("sticky");
    expect(nameCell).toHaveAttribute("data-pinned-edge", "start");
    expect(grid().querySelector("tbody [data-column=__rv_select]")).toHaveAttribute("data-pinned", "start");
    expect(grid().style.getPropertyValue("--rv-dg-pin-1")).toBe("44px");
    const scroller = container.querySelector<HTMLElement>(".rv-DataGrid-scroll")!;
    scroller.scrollLeft = 300;
    scroller.dispatchEvent(new Event("scroll"));
    await settle();
    expect(Math.round(nameCell.getBoundingClientRect().left - scroller.getBoundingClientRect().left)).toBe(44);
    expect(container.querySelector(".rv-DataGrid")).toHaveAttribute("data-scrolled-start", "true");
    const endCell = grid().querySelector<HTMLElement>("tbody [data-column=end]")!;
    expect(Math.round(scroller.getBoundingClientRect().right - endCell.getBoundingClientRect().right)).toBeLessThanOrEqual(
      scroller.offsetWidth - scroller.clientWidth,
    );
  });
});

describe("DataGrid tree rows", () => {
  const tree: Person[] = [
    {
      id: 1,
      name: "Root A",
      age: 1,
      city: "x",
      children: [
        { id: 11, name: "Child A1", age: 2, city: "y" },
        { id: 12, name: "Child A2", age: 3, city: "z" },
      ],
    },
    { id: 2, name: "Root B", age: 4, city: "w" },
  ];
  it("expands with the toggle and the keyboard (treegrid)", async () => {
    const onExpandedChange = vi.fn();
    const user = userEvent.setup();
    const { grid, rows, names } = mount(() => (
      <DataGrid aria-label="Tree" data={tree} columns={columns} getChildren={(p) => p.children} onExpandedChange={onExpandedChange} treeIndent={16} />
    ));
    expect(grid()).toHaveAttribute("role", "treegrid");
    expect(names()).toEqual(["Root A", "Root B"]);
    expect(rows()[0]).toHaveAttribute("aria-expanded", "false");
    expect(rows()[1]).not.toHaveAttribute("aria-expanded");
    rows()[0]!.querySelector<HTMLElement>("[data-rv-expand]")!.click();
    await settle();
    expect(names()).toEqual(["Root A", "Child A1", "Child A2", "Root B"]);
    expect(rows()[1]).toHaveAttribute("aria-level", "2");
    expect(rows()[1]!.querySelector<HTMLElement>("[data-rv-indent]")!.style.width).toBe("16px");
    expect([...onExpandedChange.mock.lastCall![0]]).toEqual([1]);
    rows()[1]!.focus();
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(rows()[0]);
    await user.keyboard("{ArrowLeft}");
    await settle();
    expect(names()).toEqual(["Root A", "Root B"]);
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(names()).toEqual(["Root A", "Child A1", "Child A2", "Root B"]);
  });
});

describe("DataGrid reordering", () => {
  it("reorders rows with the keyboard (Enter grab, arrows, Enter drop)", async () => {
    const data = signal(people.slice());
    const onReorder = vi.fn((e: { items: Person[] }) => data.set(e.items));
    const user = userEvent.setup();
    const { rows, names } = mount(() => <DataGrid aria-label="People" data={data} columns={columns} onReorder={onReorder} />);
    expect(rows()[0]!.children[0]).toHaveAttribute("data-column", "__rv_drag");
    const handle = rows()[0]!.querySelector<HTMLElement>("[data-rv-drag-handle]")!;
    handle.focus();
    await user.keyboard("{Enter}");
    await settle();
    expect(rows()[0]).toHaveAttribute("data-dragging", "true");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    await user.keyboard("{Enter}");
    await settle();
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder.mock.lastCall![0]).toMatchObject({ target: { key: 4, dropPosition: "before" } });
    expect(names()).toEqual(["alice", "Bob", "Charlie", "Dana"]);
  });

  it("reorders rows with the pointer", async () => {
    const data = signal(people.slice());
    const onReorder = vi.fn((e: { items: Person[] }) => data.set(e.items));
    const { rows, names, container } = mount(() => <DataGrid aria-label="People" data={data} columns={columns} onReorder={onReorder} />);
    const handle = rows()[3]!.querySelector<HTMLElement>("[data-rv-drag-handle]")!;
    const h = handle.getBoundingClientRect();
    handle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: h.left + 2, clientY: h.top + 2, pointerId: 1 }));
    const target = rows()[0]!.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: target.left + 50, clientY: target.top + 3, pointerId: 1 }));
    await settle();
    const indicator = container.querySelector<HTMLElement>("[data-rv-drop-indicator]")!;
    expect(indicator.style.display).toBe("block");
    document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: target.left + 50, clientY: target.top + 3, pointerId: 1 }));
    await settle();
    expect(onReorder.mock.lastCall![0]).toMatchObject({ target: { key: 1, dropPosition: "before" } });
    expect(names()).toEqual(["Dana", "Charlie", "alice", "Bob"]);
    expect(indicator.style.display).toBe("none");
  });
});

describe("DataGrid virtualization", () => {
  const many = Array.from({ length: 10_000 }, (_, i) => ({ id: i, name: `Person ${String(i).padStart(5, "0")}`, age: i % 90, city: `City ${i % 37}` }));

  it("renders only the visible window and keeps aria-rowcount / rowindex", async () => {
    const { grid, rows, container } = mount(() => (
      <DataGrid aria-label="Many" data={many} columns={columns} virtualized rowHeight={40} height={400} overscan={2} />
    ));
    expect(grid()).toHaveAttribute("aria-rowcount", "10001");
    const initial = rows().length;
    expect(initial).toBeLessThan(25);
    const scroller = container.querySelector<HTMLElement>(".rv-DataGrid-scroll")!;
    expect(scroller.scrollHeight).toBeGreaterThan(40 * 10_000 - 1);
    scroller.scrollTop = 40 * 5000;
    scroller.dispatchEvent(new Event("scroll"));
    await settle();
    const indexes = rows().map((r) => Number(r.getAttribute("aria-rowindex")));
    expect(indexes[0]).toBeLessThanOrEqual(5002);
    expect(indexes[indexes.length - 1]).toBeGreaterThanOrEqual(5010);
    expect(rows().length).toBeLessThan(25);
    // Visible row sits where it should.
    const row = rows().find((r) => r.dataset.key === "5003")!;
    expect(Math.round(row.getBoundingClientRect().top - scroller.getBoundingClientRect().top)).toBe(36 + 3 * 40);
  });

  it("keyboard navigation scrolls the window (End, PageUp)", async () => {
    const user = userEvent.setup();
    const { rows, container } = mount(() => <DataGrid aria-label="Many" data={many} columns={columns} virtualized rowHeight={40} height={400} />);
    rows()[0]!.focus();
    await user.keyboard("{Control>}{End}{/Control}");
    await settle();
    expect((document.activeElement as HTMLElement).dataset.key).toBe("9999");
    const scroller = container.querySelector<HTMLElement>(".rv-DataGrid-scroll")!;
    expect(scroller.scrollTop).toBeGreaterThan(40 * 9000);
    await user.keyboard("{PageUp}");
    await settle();
    expect(Number((document.activeElement as HTMLElement).dataset.key)).toBeLessThan(9999);
    await user.keyboard("{Control>}{Home}{/Control}");
    await settle();
    expect((document.activeElement as HTMLElement).dataset.key).toBe("0");
    expect(scroller.scrollTop).toBe(0);
  });

  it("selects all 10k rows and sorts without re-creating visible rows twice", async () => {
    const selected = signal<Selection>(new Set());
    const { grid, rows } = mount(() => (
      <DataGrid
        aria-label="Many"
        data={many}
        columns={columns}
        virtualized
        height={400}
        selectionMode="multiple"
        showSelectionCheckboxes
        selectedKeys={selected}
      />
    ));
    grid().querySelector<HTMLElement>("[data-rv-select-all]")!.click();
    await settle();
    expect(rows().every((r) => r.getAttribute("aria-selected") === "true")).toBe(true);
    grid().querySelector<HTMLElement>("thead [data-column=age]")!.click();
    grid().querySelector<HTMLElement>("thead [data-column=age]")!.click();
    await settle();
    expect(rows()[0]!.querySelector("[data-column=age]")).toHaveTextContent("89");
  });
});

describe("DataGrid pipeline props", () => {
  it("filters and paginates on the client", async () => {
    const query = signal("");
    const page = signal(1);
    const { names } = mount(() => (
      <DataGrid aria-label="People" data={people} columns={columns} filter={(p) => p.name.toLowerCase().includes(query())} pageSize={2} page={page} />
    ));
    expect(names()).toEqual(["Charlie", "alice"]);
    page.set(2);
    await settle();
    expect(names()).toEqual(["Bob", "Dana"]);
    query.set("a");
    page.set(1);
    await settle();
    expect(names()).toEqual(["Charlie", "alice"]);
  });

  it("load more: shows the content while loading and calls onLoadMore near the end", async () => {
    const onLoadMore = vi.fn();
    const loading = signal(false);
    const { container } = mount(() => (
      <DataGrid
        aria-label="People"
        data={people}
        columns={columns}
        onLoadMore={onLoadMore}
        isLoadingMore={loading}
        loadMoreContent={<span class="spin">Loading</span>}
      />
    ));
    await wait(50);
    expect(onLoadMore).toHaveBeenCalled();
    const content = container.querySelector(".spin")!.parentElement!;
    expect(content).toHaveAttribute("hidden");
    expect(container.querySelector("[data-load-more]")).not.toHaveAttribute("data-loading");
    loading.set(true);
    await settle();
    expect(content).not.toHaveAttribute("hidden");
    expect(container.querySelector("[data-load-more]")).toHaveAttribute("data-loading", "true");
  });
});
