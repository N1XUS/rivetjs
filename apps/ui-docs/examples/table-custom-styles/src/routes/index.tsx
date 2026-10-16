// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Tailwind CSS" };

// #region demo
const headerCell = "text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400";

const rowClass =
  "border-t border-border/60 transition-colors hover:bg-neutral-100/60 even:bg-neutral-50/50 dark:hover:bg-neutral-800/50 dark:even:bg-neutral-900/30";

export function CustomStyles() {
  return (
    <Table class="w-full max-w-2xl overflow-hidden rounded-xl border border-border/80 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <Table.ScrollContainer>
        <Table.Content aria-label="Team members" class="min-w-[600px]">
          <Table.Header class="bg-neutral-100/80 dark:bg-neutral-800/80">
            <Table.Column isRowHeader class={headerCell}>
              Name
            </Table.Column>
            <Table.Column class={headerCell}>Role</Table.Column>
            <Table.Column class={headerCell}>Status</Table.Column>
          </Table.Header>
          <Table.Body>
            <Table.Row class={rowClass}>
              <Table.Cell class="font-medium text-neutral-900 dark:text-neutral-100">Kate Moore</Table.Cell>
              <Table.Cell>CEO</Table.Cell>
              <Table.Cell>Active</Table.Cell>
            </Table.Row>
            <Table.Row class={rowClass}>
              <Table.Cell class="font-medium text-neutral-900 dark:text-neutral-100">John Smith</Table.Cell>
              <Table.Cell>CTO</Table.Cell>
              <Table.Cell>Active</Table.Cell>
            </Table.Row>
            <Table.Row class={rowClass}>
              <Table.Cell class="font-medium text-neutral-900 dark:text-neutral-100">Sara Johnson</Table.Cell>
              <Table.Cell>CMO</Table.Cell>
              <Table.Cell>On leave</Table.Cell>
            </Table.Row>
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
      <CustomStyles />
    </div>
  );
}
