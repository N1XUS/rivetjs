import { Input } from "@rivetjs/cdk/input";
import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Table: keyboard navigation" };

const people = [
  { id: "ada", name: "Ada Lovelace", role: "Analyst" },
  { id: "alan", name: "Alan Turing", role: "Cryptographer" },
  { id: "grace", name: "Grace Hopper", role: "Rear admiral" },
];

const th = "border-b border-slate-200 px-3 py-1.5 text-left font-semibold";
const td = "px-3 py-1 outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-inset data-[focus-visible]:ring-sky-500";

// #region demo
export default function EditablePeople() {
  return (
    <Table id="people" aria-label="People" keyboardNavigationBehavior="tab" class="m-4 border-collapse text-sm">
      <TableHeader>
        <Column id="name" isRowHeader class={th}>
          Name
        </Column>
        <Column id="role" class={th}>
          Role
        </Column>
      </TableHeader>
      <TableBody items={people}>
        {(person: (typeof people)[number]) => (
          <Row class="outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-sky-500">
            <Cell class={td}>{person.name}</Cell>
            <Cell class={td}>
              <TextField aria-label={"Role of " + person.name} defaultValue={person.role}>
                <Input class="rounded border border-slate-300 px-2 py-0.5 outline-none focus:ring-2 focus:ring-sky-500" />
              </TextField>
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}
// #endregion
