import { signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import { Button } from "@rivetjs/cdk/button";
import { Cell, Column, Row, Table, TableBody, TableHeader, type CellProps } from "@rivetjs/cdk/table";
import type { Key } from "@rivetjs/cdk/collections/types";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Table: expandable rows" };

const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";
const tr = "outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";

/** The tree column cell: indentation from --table-row-level, a chevron button on parent rows. */
function NameCell(props: CellProps & { label: string }) {
  return (
    <Cell class={td}>
      {({ hasChildItems, isExpanded }) => (
        <div class="flex items-center gap-1" style={{ "padding-inline-start": "calc((var(--table-row-level) - 1) * 1rem)" }}>
          {hasChildItems() ? (
            <Button slot="chevron" class="grid size-5 place-items-center rounded text-slate-500 hover:bg-slate-200">
              <Icon icon={ChevronRight} size={14} class={isExpanded() ? "rotate-90 transition-transform" : "transition-transform"} />
            </Button>
          ) : (
            <span class="size-5" />
          )}
          {props.label}
        </div>
      )}
    </Cell>
  );
}

// #region demo
export default function FileTree() {
  const expanded = signal(new Set<Key>(["documents"]));
  return (
    <section class="m-4 grid gap-2 text-sm">
      <Table id="tree" aria-label="Files" treeColumn="name" expandedKeys={expanded} class="border-collapse">
        <TableHeader>
          <Column id="name" isRowHeader class={th}>
            Name
          </Column>
          <Column id="type" class={th}>
            Type
          </Column>
          <Column id="date" class={th}>
            Date Modified
          </Column>
        </TableHeader>
        <TableBody>
          <Row id="documents" class={tr}>
            <NameCell label="Documents" />
            <Cell class={td}>Directory</Cell>
            <Cell class={td}>10/20/2025</Cell>
            <Row id="project" class={tr}>
              <NameCell label="Project" />
              <Cell class={td}>Directory</Cell>
              <Cell class={td}>8/2/2025</Cell>
              <Row id="weekly" class={tr}>
                <NameCell label="Weekly Report" />
                <Cell class={td}>File</Cell>
                <Cell class={td}>7/10/2025</Cell>
              </Row>
            </Row>
          </Row>
          <Row id="photos" class={tr}>
            <NameCell label="Photos" />
            <Cell class={td}>Directory</Cell>
            <Cell class={td}>2/3/2026</Cell>
            <Row id="image" class={tr}>
              <NameCell label="Image 1" />
              <Cell class={td}>File</Cell>
              <Cell class={td}>1/23/2026</Cell>
            </Row>
          </Row>
        </TableBody>
      </Table>
      <p id="tree-expanded">Expanded: {[...expanded()].join(", ") || "none"}</p>
    </section>
  );
}
// #endregion
