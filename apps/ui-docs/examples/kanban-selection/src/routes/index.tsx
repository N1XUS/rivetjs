// Rivet-authored Kanban demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import type { Selection } from "@rivetjs/cdk/collections/types";
import { signal } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";

export const head = { title: "Kanban: Card selection" };

// #region demo
type Task = { id: string; title: string; status: string };

const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "var(--muted)" },
  { id: "progress", title: "In progress", color: "var(--warning)" },
  { id: "done", title: "Done", color: "var(--success)" },
];

const TASKS: Task[] = [
  { id: "1", title: "Collect venue quotes", status: "backlog" },
  { id: "2", title: "Shortlist caterers", status: "backlog" },
  { id: "3", title: "Draft the invite email", status: "backlog" },
  { id: "4", title: "Design name badges", status: "progress" },
  { id: "5", title: "Confirm keynote speaker", status: "done" },
];

const count = (keys: Selection, total: number) => (keys === "all" ? total : keys.size);

export function CardSelection() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  // One selection signal per column (two-way `selectedKeys`).
  const selected: Record<string, Signal<Selection>> = {
    backlog: signal<Selection>(new Set(["2"])),
    progress: signal<Selection>(new Set()),
    done: signal<Selection>(new Set()),
  };
  return (
    <Kanban id="kanban-select" class="w-full max-w-4xl">
      {COLUMNS.map((column) => (
        <Kanban.Column>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator color={column.color} />
            <Kanban.ColumnTitle id={`kanban-select-${column.id}-title`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount id={`kanban-select-${column.id}-selected`}>
              {count(selected[column.id]!(), board.itemsOf(column.id).length)} selected
            </Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList
              id={`kanban-select-${column.id}`}
              aria-labelledby={`kanban-select-${column.id}-title`}
              data={column.id}
              onDropped={board.onDropped}
              selectionMode="multiple"
              selectedKeys={selected[column.id]}
              renderEmptyState={() => "No tasks"}
            >
              <For each={() => board.itemsOf(column.id)} by={(task) => task.id}>
                {(task) => (
                  <Kanban.Card data={task().id} textValue={task().title}>
                    <Kanban.CardContent>{task().title}</Kanban.CardContent>
                  </Kanban.Card>
                )}
              </For>
            </Kanban.CardList>
          </Kanban.ColumnBody>
        </Kanban.Column>
      ))}
    </Kanban>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6">
      <CardSelection />
    </div>
  );
}
