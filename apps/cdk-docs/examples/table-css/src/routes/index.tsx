import { Cell, Column, Row, Table, TableBody, TableHeader } from "@rivetjs/cdk/table";

export const head = { title: "Table with plain CSS" };

const people = [
  { id: "ada", name: "Ada Lovelace", email: "ada@example.com", status: "Active" },
  { id: "alan", name: "Alan Turing", email: "alan@example.com", status: "Away" },
  { id: "grace", name: "Grace Hopper", email: "grace@example.com", status: "Active" },
];

// #region demo
export default function People() {
  return (
    <Table id="team" aria-label="Team" selectionMode="single" disabledKeys={["alan"]}>
      <TableHeader>
        <Column id="name" isRowHeader>
          Name
        </Column>
        <Column id="email">Email</Column>
        <Column id="status">Status</Column>
      </TableHeader>
      <TableBody items={people}>
        {(person: (typeof people)[number]) => (
          <Row>
            <Cell>{person.name}</Cell>
            <Cell>{person.email}</Cell>
            <Cell>{person.status}</Cell>
          </Row>
        )}
      </TableBody>
    </Table>
  );
}
// #endregion
