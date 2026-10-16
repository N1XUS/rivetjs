import { signal } from "@rivetjs/reactivity";
import { Cell, Column, ColumnResizer, ResizableTableContainer, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "Table: column resizing" };

const rows = [
  { id: 1, name: "2022 Roadmap Proposal Revision 012822 Copy (2)", date: "November 27, 2022 at 4:56PM", size: "214 KB" },
  { id: 2, name: "Budget", date: "January 27, 2021 at 1:56AM", size: "14 MB" },
  { id: 3, name: "Welcome Email Template", date: "July 24, 2022 at 2:48 PM", size: "20 KB" },
];

const th = "relative border-b border-slate-200 px-3 py-1.5 text-left font-semibold outline-none";
const td = "truncate px-3 py-1.5";
const resizer =
  "absolute inset-y-1 right-0 w-1 cursor-col-resize rounded bg-slate-300 outline-none data-[hovered]:bg-sky-500 data-[resizing]:bg-sky-600 data-[focus-visible]:bg-sky-600";

// #region demo
export default function ResizableFiles() {
  const widths = signal("none");
  return (
    <section class="m-4 grid gap-2 text-sm">
      <ResizableTableContainer
        class="max-w-xl overflow-auto rounded-lg border border-slate-200"
        onResizeEnd={(map) => widths.set([...map].map(([key, width]) => `${String(key)}=${String(width)}`).join(", "))}
      >
        <Table id="resizable" aria-label="Table with resizable columns">
          <TableHeader>
            <Column id="file" isRowHeader maxWidth={500} class={th}>
              File Name
              <ColumnResizer class={resizer} />
            </Column>
            <Column id="size" defaultWidth={100} class={th}>
              Size
              <ColumnResizer class={resizer} />
            </Column>
            <Column id="date" minWidth={100} class={th}>
              Date Modified
            </Column>
          </TableHeader>
          <TableBody items={rows}>
            {(item: (typeof rows)[number]) => (
              <Row>
                <Cell class={td}>{item.name}</Cell>
                <Cell class={td}>{item.size}</Cell>
                <Cell class={td}>{item.date}</Cell>
              </Row>
            )}
          </TableBody>
        </Table>
      </ResizableTableContainer>
      <p id="resizable-widths">Widths after resize: {widths()}</p>
    </section>
  );
}
// #endregion
