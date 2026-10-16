// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/selection.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { signal } from "@rivetjs/reactivity";
import type { Selection } from "@rivetjs/cdk/collections/types";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Selection" };

// #region demo

const users = [
  { email: "kate@acme.com", id: 1, name: "Kate Moore", role: "CEO", status: "Active" },
  { email: "john@acme.com", id: 2, name: "John Smith", role: "CTO", status: "Active" },
  { email: "sara@acme.com", id: 3, name: "Sara Johnson", role: "CMO", status: "On Leave" },
  { email: "michael@acme.com", id: 4, name: "Michael Brown", role: "CFO", status: "Active" },
];

export function SelectionDemo() {
  const selectedKeys = signal<Selection>(new Set());

  return (
    <div class="flex flex-col gap-3">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Table with selection" class="min-w-[600px]" selectedKeys={selectedKeys} selectionMode="multiple">
            <Table.Header>
              <Table.Column class="pe-0">
                <Checkbox aria-label="Select all" slot="selection">
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                  </Checkbox.Content>
                </Checkbox>
              </Table.Column>
              <Table.Column isRowHeader>Name</Table.Column>
              <Table.Column>Role</Table.Column>
              <Table.Column>Status</Table.Column>
              <Table.Column>Email</Table.Column>
            </Table.Header>
            <Table.Body>
              {users.map((user) => (
                <Table.Row id={user.id}>
                  <Table.Cell class="pe-0">
                    <Checkbox aria-label={`Select ${user.name}`} slot="selection" variant="secondary">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                      </Checkbox.Content>
                    </Checkbox>
                  </Table.Cell>
                  <Table.Cell>{user.name}</Table.Cell>
                  <Table.Cell>{user.role}</Table.Cell>
                  <Table.Cell>{user.status}</Table.Cell>
                  <Table.Cell>{user.email}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p class="text-sm text-muted">
        Selected:{" "}
        <span class="font-medium">
          {(() => {
            const keys = selectedKeys();
            return keys === "all" ? "All" : keys.size > 0 ? Array.from(keys).join(", ") : "None";
          })()}
        </span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <SelectionDemo />
    </div>
  );
}
