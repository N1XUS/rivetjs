/** @jsxImportSource react */
// Orders data table (TanStack Table v9): sort by column header, text filter (id / customer / email), status filter,
// 25 rows per page; a row click opens the order detail dialog (OrderModal, same React tree).
import { useState } from "react";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Order } from "../data.ts";
import { OrderModal } from "./OrderModal.react.tsx";

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
const helper = createColumnHelper<typeof features, Order>();
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const columns = helper.columns([
  helper.accessor("id", { header: "Order", sortFn: "alphanumeric" }),
  helper.accessor("customer", { header: "Customer", sortFn: "alphanumeric" }),
  helper.accessor("status", {
    header: "Status",
    filterFn: "equalsString",
    enableGlobalFilter: false,
    cell: (info) => <span className={"status " + info.getValue()}>{info.getValue()}</span>,
  }),
  helper.accessor("items", { header: "Items", sortFn: "basic", enableGlobalFilter: false }),
  helper.accessor("total", { header: "Total", sortFn: "basic", enableGlobalFilter: false, cell: (info) => money.format(info.getValue()) }),
  helper.accessor("date", { header: "Date", sortFn: "alphanumeric", enableGlobalFilter: false }),
]);
const STATUSES = ["all", "paid", "pending", "refunded", "failed"] as const;

export function OrdersTable(props: { orders: Order[] }) {
  const [open, setOpen] = useState<Order | null>(null);
  const table = useTable({
    features,
    columns,
    data: props.orders,
    globalFilterFn: "includesString",
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });
  const status = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all";
  const { pageIndex } = table.state.pagination;
  return (
    <section className="orders">
      <div className="toolbar">
        <input
          id="filter"
          type="search"
          placeholder="Filter by order, customer or email"
          aria-label="Filter orders"
          value={(table.state.globalFilter as string | undefined) ?? ""}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
        <select
          id="status"
          aria-label="Status"
          value={status}
          onChange={(event) => table.getColumn("status")?.setFilterValue(event.target.value === "all" ? undefined : event.target.value)}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <output id="row-count">{table.getFilteredRowModel().rows.length} orders</output>
      </div>
      <table className="grid">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <th key={header.id} aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}>
                    <button className="sort" data-col={header.column.id} onClick={header.column.getToggleSortingHandler()}>
                      <table.FlexRender header={header} />
                      <span className="dir">{sorted === "asc" ? " (asc)" : sorted === "desc" ? " (desc)" : ""}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} data-id={row.original.id} onClick={() => setOpen(row.original)}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button id="prev" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Previous
        </button>
        <span id="page">
          Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
        </span>
        <button id="next" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Next
        </button>
      </div>
      <OrderModal order={open} onClose={() => setOpen(null)} />
    </section>
  );
}
