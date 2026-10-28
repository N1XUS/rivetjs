// `@rivetjs/ui/table-tanstack`: TanStack Table v9 (`@tanstack/table-core`) on Rivet signals — row models track the state,
// options and data they read (computed / effect re-runs), Signal / accessor / atom / plain state slices, live `data` /
// `columns`, `flexRender`, sort descriptor bridge, auto page reset after a sort.
import { test } from "vitest";
import assert from "node:assert/strict";
import { computed, effect, createRoot, signal } from "@rivetjs/reactivity";
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  createTable,
  flexRender,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  sortingAtom,
  tableFeatures,
  toSortDescriptor,
  toSorting,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "../src/table-tanstack/index.ts";

interface User {
  id: number;
  name: string;
  role: string;
}
const users: User[] = [
  { id: 1, name: "Kate Moore", role: "CEO" },
  { id: 2, name: "John Smith", role: "CTO" },
  { id: 3, name: "Sara Johnson", role: "CMO" },
  { id: 4, name: "Michael Brown", role: "CFO" },
  { id: 5, name: "Emily Davis", role: "Product Manager" },
];

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});
const helper = createColumnHelper<typeof features, User>();
const columns = helper.columns([
  helper.accessor("name", { header: "Name" }),
  helper.accessor("role", { header: () => "Role", cell: (info) => `<${info.getValue()}>` }),
]);
const names = (rows: { original: User }[]) => rows.map((r) => r.original.name);
const tick = () => new Promise<void>((r) => queueMicrotask(r));

test("table-tanstack: sorting through a Signal slice re-runs a computed row model", () => {
  createRoot((dispose) => {
    const sorting = signal<SortingState>([]);
    const table = createTable({ features, columns, data: users, getRowId: (u) => String(u.id), state: { sorting } });
    let runs = 0;
    const rows = computed(() => (runs++, names(table.getRowModel().rows)));
    assert.deepEqual(rows(), ["Kate Moore", "John Smith", "Sara Johnson", "Michael Brown", "Emily Davis"]);
    sorting.set([{ id: "name", desc: false }]);
    assert.deepEqual(rows(), ["Emily Davis", "John Smith", "Kate Moore", "Michael Brown", "Sara Johnson"]);
    // A table setter writes the owning signal (two-way).
    table.setSorting([{ id: "name", desc: true }]);
    assert.deepEqual(sorting(), [{ id: "name", desc: true }]);
    assert.equal(rows()[0], "Sara Johnson");
    assert.equal(table.getColumn("name")!.getIsSorted(), "desc");
    // Unrelated reads do not re-run the computed.
    const before = runs;
    rows();
    assert.equal(runs, before);
    assert.equal(table.getRow("3").original.name, "Sara Johnson");
    dispose();
  });
});

test("table-tanstack: internal state (no slice given) is signal-backed too", () => {
  createRoot((dispose) => {
    const table = createTable({ features, columns, data: users });
    const seen: string[] = [];
    effect(() => {
      seen.push(table.getRowModel().rows[0]!.original.name);
    });
    table.getColumn("role")!.toggleSorting(true);
    assert.deepEqual(seen, ["Kate Moore", "Emily Davis"]);
    assert.deepEqual(table.atoms.sorting.get(), [{ id: "role", desc: true }]);
    assert.deepEqual(table.store.state.sorting, [{ id: "role", desc: true }]);
    dispose();
  });
});

test("table-tanstack: pagination (page model, counts, next / previous, Signal slice)", () => {
  createRoot((dispose) => {
    const pagination = signal<PaginationState>({ pageIndex: 0, pageSize: 2 });
    const table = createTable({ features, columns, data: users, state: { pagination } });
    const page = computed(() => names(table.getRowModel().rows));
    assert.equal(table.getPageCount(), 3);
    assert.equal(table.getRowCount(), 5);
    assert.deepEqual(page(), ["Kate Moore", "John Smith"]);
    assert.equal(table.getCanPreviousPage(), false);
    table.nextPage();
    assert.deepEqual(pagination(), { pageIndex: 1, pageSize: 2 });
    assert.deepEqual(page(), ["Sara Johnson", "Michael Brown"]);
    pagination.set({ pageIndex: 2, pageSize: 2 });
    assert.deepEqual(page(), ["Emily Davis"]);
    assert.equal(table.getCanNextPage(), false);
    table.setPageSize(5);
    assert.equal(table.getPageCount(), 1);
    dispose();
  });
});

test("table-tanstack: a sort resets the page index (table-core autoResetPageIndex, scheduled)", async () => {
  const pagination = signal<PaginationState>({ pageIndex: 1, pageSize: 2 });
  const sorting = signal<SortingState>([]);
  const root = createRoot((dispose) => {
    const table = createTable({ features, columns, data: users, state: { pagination, sorting } });
    const page = computed(() => names(table.getRowModel().rows));
    page();
    return { page, dispose };
  });
  sorting.set([{ id: "name", desc: false }]);
  root.value.page();
  await tick();
  assert.equal(pagination().pageIndex, 0);
  assert.deepEqual(root.value.page(), ["Emily Davis", "John Smith"]);
  root.dispose();
});

test("table-tanstack: column visibility (accessor slice + change handler)", () => {
  createRoot((dispose) => {
    const visibility = signal<Record<string, boolean>>({});
    const changes: unknown[] = [];
    const table = createTable({
      features,
      columns,
      data: users,
      state: { columnVisibility: () => visibility() },
      onColumnVisibilityChange: (updater) => {
        const next = typeof updater === "function" ? updater(visibility()) : updater;
        changes.push({ ...next });
        visibility.set(next);
      },
    });
    const ids = computed(() =>
      table
        .getRowModel()
        .rows[0]!.getVisibleCells()
        .map((c) => c.column.id),
    );
    assert.deepEqual(ids(), ["name", "role"]);
    table.getColumn("role")!.toggleVisibility(false);
    assert.deepEqual(changes, [{ role: false }]);
    assert.deepEqual(ids(), ["name"]);
    assert.equal(table.getColumn("role")!.getIsVisible(), false);
    visibility.set({});
    assert.deepEqual(ids(), ["name", "role"]);
    assert.deepEqual(
      table.getVisibleLeafColumns().map((c) => c.id),
      ["name", "role"],
    );
    dispose();
  });
});

test("table-tanstack: live data and columns accessors", () => {
  createRoot((dispose) => {
    const data = signal<User[]>(users.slice(0, 2));
    const cols = signal<ReadonlyArray<ColumnDef<typeof features, User, any>>>(columns);
    const sorting = signal<SortingState>([{ id: "name", desc: false }]);
    const table = createTable({ features, columns: () => cols(), data: () => data(), state: { sorting } });
    const rows = computed(() => names(table.getRowModel().rows));
    assert.deepEqual(rows(), ["John Smith", "Kate Moore"]);
    data.set([...data(), { id: 9, name: "Anna Lee", role: "COO" }]);
    assert.deepEqual(rows(), ["Anna Lee", "John Smith", "Kate Moore"]);
    assert.equal(table.getRowCount(), 3);
    const headers = computed(() => table.getHeaderGroups()[0]!.headers.map((h) => h.column.id));
    assert.deepEqual(headers(), ["name", "role"]);
    cols.set(helper.columns([helper.accessor("role", { header: "Role" })]));
    assert.deepEqual(headers(), ["role"]);
    // setOptions keeps the live accessors (descriptor merge); the sort needs its `name` column back.
    cols.set(columns);
    table.setOptions((prev) => ({ ...prev, enableSorting: true }));
    data.set(users.slice(3));
    assert.deepEqual(rows(), ["Emily Davis", "Michael Brown"]);
    dispose();
  });
});

test("table-tanstack: flexRender / FlexRender", () => {
  createRoot((dispose) => {
    const table = createTable({ features, columns, data: users });
    const [name, role] = table.getHeaderGroups()[0]!.headers;
    assert.equal(flexRender(name!.column.columnDef.header, name!.getContext()), "Name");
    assert.equal(flexRender(role!.column.columnDef.header, role!.getContext()), "Role");
    const cells = table.getRowModel().rows[0]!.getVisibleCells();
    assert.equal(FlexRender({ cell: cells[0]! }), "Kate Moore");
    assert.equal(FlexRender({ cell: cells[1]! }), "<CEO>");
    assert.equal(FlexRender({ header: name! }), "Name");
    assert.equal(flexRender(undefined, {}), null);
    assert.equal(flexRender("static", {}), "static");
    dispose();
  });
});

test("table-tanstack: sort descriptor bridge (toSortDescriptor / toSorting / sortingAtom)", () => {
  assert.equal(toSortDescriptor([]), null);
  assert.deepEqual(toSortDescriptor([{ id: "name", desc: true }]), { column: "name", direction: "descending" });
  assert.deepEqual(toSorting({ column: "role", direction: "ascending" }), [{ id: "role", desc: false }]);
  assert.deepEqual(toSorting(null), []);
  createRoot((dispose) => {
    const descriptor = signal<{ column: string | number; direction: "ascending" | "descending" } | null>(null);
    const table = createTable({ features, columns, data: users, state: { sorting: sortingAtom(descriptor) } });
    const first = computed(() => table.getRowModel().rows[0]!.original.name);
    assert.equal(first(), "Kate Moore");
    descriptor.set({ column: "name", direction: "ascending" });
    assert.equal(first(), "Emily Davis");
    table.getColumn("name")!.toggleSorting(true);
    assert.deepEqual(descriptor(), { column: "name", direction: "descending" });
    assert.equal(first(), "Sara Johnson");
    dispose();
  });
});
