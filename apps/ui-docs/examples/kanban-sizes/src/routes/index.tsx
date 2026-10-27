// Rivet-authored Kanban demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";

export const head = { title: "Kanban: Sizes" };

// #region demo
type Task = { id: string; title: string; status: string };

const COLUMNS = [
  { id: "backlog", title: "Backlog", color: "var(--muted)" },
  { id: "progress", title: "In progress", color: "var(--warning)" },
  { id: "review", title: "Review", color: "var(--accent)" },
  { id: "done", title: "Done", color: "var(--success)" },
];

const TASKS: Task[] = [
  { id: "1", title: "Audit onboarding emails", status: "backlog" },
  { id: "2", title: "Draft pricing FAQ", status: "backlog" },
  { id: "3", title: "Billing settings page", status: "progress" },
  { id: "4", title: "Dark mode screenshots", status: "review" },
  { id: "5", title: "Release notes 2.4", status: "done" },
];

export function Sizes() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  return (
    <Kanban id="kanban-sizes" size="sm" class="w-full max-w-5xl">
      {COLUMNS.map((column) => (
        <Kanban.Column aria-labelledby={`kanban-sizes-${column.id}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator color={column.color} />
            <Kanban.ColumnTitle id={`kanban-sizes-${column.id}`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount>{board.itemsOf(column.id).length}</Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={column.id} onDropped={board.onDropped} renderEmptyState={() => "Drop a task here"}>
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
      <Sizes />
    </div>
  );
}
