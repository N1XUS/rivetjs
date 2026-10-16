import { Check, Minus } from "lucide";
import { Checkbox } from "@rivetjs/cdk/checkbox";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Table" };

const th =
  "border-b border-slate-200 px-3 py-1.5 text-left font-semibold outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";
const td = "px-3 py-1.5 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";
const tr =
  "cursor-default outline-none data-[selected]:bg-sky-50 data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";
const box =
  "grid size-4 place-items-center rounded border border-slate-400 text-white data-[selected]:border-sky-600 data-[selected]:bg-sky-600 data-[indeterminate]:border-sky-600 data-[indeterminate]:bg-sky-600";

// #region demo
export default function Files() {
  return (
    <Table id="files" aria-label="Files" selectionMode="multiple" class="m-4 border-collapse text-sm">
      <TableHeader>
        <Column id="select" class={th + " w-8"}>
          <Checkbox slot="selection" class={box}>
            {({ isSelected, isIndeterminate }) =>
              isIndeterminate() ? <Icon icon={Minus} size={12} strokeWidth={3} /> : isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null
            }
          </Checkbox>
        </Column>
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
        <Row id="games" class={tr}>
          <Cell class={td}>
            <Checkbox slot="selection" class={box}>
              {({ isSelected }) => (isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null)}
            </Checkbox>
          </Cell>
          <Cell class={td}>Games</Cell>
          <Cell class={td}>Folder</Cell>
          <Cell class={td}>6/7/2023</Cell>
        </Row>
        <Row id="apps" class={tr}>
          <Cell class={td}>
            <Checkbox slot="selection" class={box}>
              {({ isSelected }) => (isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null)}
            </Checkbox>
          </Cell>
          <Cell class={td}>Applications</Cell>
          <Cell class={td}>Folder</Cell>
          <Cell class={td}>4/7/2025</Cell>
        </Row>
        <Row id="report" class={tr}>
          <Cell class={td}>
            <Checkbox slot="selection" class={box}>
              {({ isSelected }) => (isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null)}
            </Checkbox>
          </Cell>
          <Cell class={td}>2024 Financial Report</Cell>
          <Cell class={td}>PDF Document</Cell>
          <Cell class={td}>12/30/2024</Cell>
        </Row>
        <Row id="job" class={tr}>
          <Cell class={td}>
            <Checkbox slot="selection" class={box}>
              {({ isSelected }) => (isSelected() ? <Icon icon={Check} size={12} strokeWidth={3} /> : null)}
            </Checkbox>
          </Cell>
          <Cell class={td}>Job Posting</Cell>
          <Cell class={td}>Text Document</Cell>
          <Cell class={td}>1/18/2025</Cell>
        </Row>
      </TableBody>
    </Table>
  );
}
// #endregion
