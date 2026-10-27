// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/table/expandable-rows.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ChevronRight } from "lucide";
import type { Key } from "@rivetjs/cdk/collections/types";
import { cn } from "tailwind-variants";
import { Table } from "@rivetjs/ui/table";

export const head = { title: "Table: Expandable Rows" };

// #region demo
export function ExpandableRows() {
  type Row = {
    children: Row[];
    date: string;
    id: string;
    title: string;
    type: string;
  };

  const data: Row[] = [
    {
      children: [
        {
          children: [
            { children: [], date: "7/10/2025", id: "3", title: "Weekly Report", type: "File" },
            { children: [], date: "8/20/2025", id: "4", title: "Budget", type: "File" },
          ],
          date: "8/2/2025",
          id: "2",
          title: "Project",
          type: "Directory",
        },
      ],
      date: "10/20/2025",
      id: "1",
      title: "Documents",
      type: "Directory",
    },
    {
      children: [
        { children: [], date: "1/23/2026", id: "6", title: "Image 1", type: "File" },
        { children: [], date: "2/3/2026", id: "7", title: "Image 2", type: "File" },
      ],
      date: "2/3/2026",
      id: "5",
      title: "Photos",
      type: "Directory",
    },
  ];

  const expandedKeys = signal(new Set<Key>(["1"]));

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content aria-label="Files" class="min-w-[520px]" expandedKeys={expandedKeys} treeColumn="name">
          <Table.Header>
            <Table.Column isRowHeader id="name">
              Name
            </Table.Column>
            <Table.Column id="type">Type</Table.Column>
            <Table.Column id="date">Date Modified</Table.Column>
          </Table.Header>
          {/* The row renderer is written inline (a named function for the recursion): a Table part built outside a
              Table's JSX (a helper or wrapper component) turns the static-table (zero JS) path off app-wide. */}
          <Table.Body items={data}>
            {function renderExpandableRow(item: Row) {
              return (
                <Table.Row id={item.id} textValue={item.title}>
                  <Table.Cell textValue={item.title}>
                    {({ hasChildItems, isDisabled, isExpanded, isTreeColumn }) => (
                      <span class="flex items-center gap-1">
                        {hasChildItems() && isTreeColumn() ? (
                          <Button isIconOnly aria-label="Toggle row" isDisabled={isDisabled()} size="sm" slot="chevron" variant="ghost">
                            <Icon
                              aria-hidden
                              icon={ChevronRight}
                              class={cn("size-4 text-muted transition-transform duration-150", isExpanded() ? "rotate-90" : "rtl:rotate-180")}
                            />
                          </Button>
                        ) : null}
                        <span>{item.title}</span>
                      </span>
                    )}
                  </Table.Cell>
                  <Table.Cell>{item.type}</Table.Cell>
                  <Table.Cell>{item.date}</Table.Cell>
                  <Table.Collection items={item.children}>{renderExpandableRow}</Table.Collection>
                </Table.Row>
              );
            }}
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
      <ExpandableRows />
    </div>
  );
}
