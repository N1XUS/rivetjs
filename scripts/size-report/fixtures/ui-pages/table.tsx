// ui page-CSS fixture: data table (Table).
import { Table } from "@rivetjs/ui/table";

export default function Page() {
  return (
    <main>
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Team members">
            <Table.Header>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Role</Table.Column>
            </Table.Header>
            <Table.Body>
              <Table.Row>
                <Table.Cell>Kate Moore</Table.Cell>
                <Table.Cell>CEO</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </main>
  );
}
