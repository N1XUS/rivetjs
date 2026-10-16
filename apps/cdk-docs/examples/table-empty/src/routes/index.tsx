import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "Table: empty state" };

const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";

// #region demo
export default function SearchResults() {
  return (
    <Table id="results" aria-label="Search results" class="m-4 w-96 border-collapse text-sm">
      <TableHeader>
        <Column isRowHeader class={th}>
          Name
        </Column>
        <Column class={th}>Type</Column>
        <Column class={th}>Date Modified</Column>
      </TableHeader>
      <TableBody
        items={[] as { id: string; name: string; type: string; date: string }[]}
        renderEmptyState={() => <p class="py-6 text-center text-slate-500">No results found.</p>}
        class="data-[empty]:italic"
      >
        {(item: { id: string; name: string; type: string; date: string }) => (
          <Row>
            <Cell>{item.name}</Cell>
            <Cell>{item.type}</Cell>
            <Cell>{item.date}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}
// #endregion
