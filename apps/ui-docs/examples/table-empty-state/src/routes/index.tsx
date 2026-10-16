// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/empty-state.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Inbox } from "lucide";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Empty State" };

// #region demo
export function EmptyStateDemo() {
  return (
    <Table class="min-h-[200px]">
      <Table.ScrollContainer>
        <Table.Content aria-label="Empty table" class="h-full min-w-[600px]">
          <Table.Header>
            <Table.Column isRowHeader>Name</Table.Column>
            <Table.Column>Role</Table.Column>
            <Table.Column>Status</Table.Column>
            <Table.Column>Email</Table.Column>
          </Table.Header>
          <Table.Body
            renderEmptyState={() => (
              <EmptyState class="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
                <Icon class="size-6 text-muted" icon={Inbox} />
                <span class="text-sm text-muted">No results found</span>
              </EmptyState>
            )}
          >
            {[]}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <EmptyStateDemo />
    </div>
  );
}
