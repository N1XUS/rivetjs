// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/column-resizing.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Chip } from "@rivetjs/ui/chip";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Column Resizing" };

// #region demo
export function ColumnResizing() {
  return (
    <Table>
      <Table.ResizableContainer>
        <Table.Content aria-label="Table with resizable columns" class="min-w-[700px]">
          <Table.Header>
            <Table.Column isRowHeader defaultWidth="1fr" id="name" minWidth={160}>
              Name
              <Table.ColumnResizer />
            </Table.Column>
            <Table.Column defaultWidth="1fr" id="role" minWidth={220}>
              Role
              <Table.ColumnResizer />
            </Table.Column>
            <Table.Column defaultWidth="1fr" id="status" minWidth={100}>
              Status
              <Table.ColumnResizer />
            </Table.Column>
            <Table.Column defaultWidth="1fr" id="email" minWidth={200}>
              Email
            </Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell>Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
              <Table.Cell>
                <Chip color="success" size="sm" variant="soft">
                  Active
                </Chip>
              </Table.Cell>
              <Table.Cell>kate@acme.com</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
              <Table.Cell>
                <Chip color="success" size="sm" variant="soft">
                  Active
                </Chip>
              </Table.Cell>
              <Table.Cell>john@acme.com</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Sara Johnson</Table.Cell>
              <Table.Cell>CMO</Table.Cell>
              <Table.Cell>
                <Chip color="warning" size="sm" variant="soft">
                  On Leave
                </Chip>
              </Table.Cell>
              <Table.Cell>sara@acme.com</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Michael Brown</Table.Cell>
              <Table.Cell>CFO</Table.Cell>
              <Table.Cell>
                <Chip color="success" size="sm" variant="soft">
                  Active
                </Chip>
              </Table.Cell>
              <Table.Cell>michael@acme.com</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell>Emily Davis</Table.Cell>
              <Table.Cell>Product Manager</Table.Cell>
              <Table.Cell>
                <Chip color="danger" size="sm" variant="soft">
                  Inactive
                </Chip>
              </Table.Cell>
              <Table.Cell>emily@acme.com</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Content>
      </Table.ResizableContainer>
    </Table>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ColumnResizing />
    </div>
  );
}
