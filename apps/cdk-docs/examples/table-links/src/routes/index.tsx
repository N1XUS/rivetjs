import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "Table: links" };

const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1.5";
const tr =
  "cursor-pointer outline-none data-[hovered]:bg-slate-50 data-[selected]:bg-sky-700 data-[selected]:text-white data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";

// #region demo
export default function Bookmarks() {
  return (
    <Table id="bookmarks" aria-label="Bookmarks" selectionMode="multiple" selectionBehavior="replace" class="m-4 border-collapse text-sm">
      <TableHeader>
        <Column isRowHeader class={th}>
          Name
        </Column>
        <Column class={th}>URL</Column>
        <Column class={th}>Date added</Column>
      </TableHeader>
      <TableBody>
        <Row id="adobe" href="https://adobe.com/" target="_blank" class={tr}>
          <Cell class={td}>Adobe</Cell>
          <Cell class={td}>https://adobe.com/</Cell>
          <Cell class={td}>January 28, 2023</Cell>
        </Row>
        <Row id="google" href="https://google.com/" target="_blank" class={tr}>
          <Cell class={td}>Google</Cell>
          <Cell class={td}>https://google.com/</Cell>
          <Cell class={td}>April 5, 2023</Cell>
        </Row>
        <Row id="nyt" href="https://nytimes.com/" target="_blank" class={tr}>
          <Cell class={td}>New York Times</Cell>
          <Cell class={td}>https://nytimes.com/</Cell>
          <Cell class={td}>July 12, 2023</Cell>
        </Row>
      </TableBody>
    </Table>
  );
}
// #endregion
