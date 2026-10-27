// TABLE-NATIVE — static Table story (`/table-static`): a compound Table whose every part passes declared data props only
// (the build proves the call site, ZERO STATESPACE family): native `<table>` markup, no record, no JavaScript before or
// after input. 120 rows (`#ts-large`) + the auto form (`#ts-auto`: `columns` + `items` + `footer`).
import { Table } from "@rivetjs/ui/table";

const ROWS = Array.from({ length: 120 }, (_, i) => ({ id: `m${i}`, name: `Member ${i}`, role: ["CEO", "CTO", "CMO"][i % 3]!, email: `m${i}@acme.com` }));

const COLUMNS = [
  { id: "name", name: "Name", isRowHeader: true },
  { id: "role", name: "Role" },
];

const ITEMS = [
  { id: "1", name: "Kate", role: "CEO" },
  { id: "2", name: "John", role: "CTO" },
];

export default function TableStatic() {
  return (
    <main>
      <h2 id="ts-large-title">Members</h2>
      <Table id="ts-large">
        <Table.ScrollContainer>
          <Table.Content id="ts-large-table" aria-labelledby="ts-large-title" class="min-w-[600px]">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Role</Table.Column>
              <Table.Column>Email</Table.Column>
            </Table.Header>
            <Table.Body>
              {ROWS.map((row) => (
                <Table.Row>
                  <Table.Cell>{row.name}</Table.Cell>
                  <Table.Cell>{row.role}</Table.Cell>
                  <Table.Cell>{row.email}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <Table id="ts-auto" aria-label="Team" columns={COLUMNS} items={ITEMS} footer="2 members" />
    </main>
  );
}
