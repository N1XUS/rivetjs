// Rivet-authored Kanban demo (Rivet addition; KanbanComposer, own demo content).
import { For } from "@rivetjs/runtime/dom";
import { Kanban, KanbanComposer, createKanban } from "@rivetjs/ui/kanban";

export const head = { title: "Kanban: Add a card" };

// #region demo
type Task = { id: string; title: string; status: string };

const COLUMNS = [
  { id: "todo", title: "To do" },
  { id: "progress", title: "In progress" },
  { id: "done", title: "Done" },
];

const TASKS: Task[] = [
  { id: "1", title: "Collect speaker bios", status: "todo" },
  { id: "2", title: "Order the badges", status: "todo" },
  { id: "3", title: "Draft the schedule", status: "progress" },
  { id: "4", title: "Book the venue", status: "done" },
];

export function Composer() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  const add = (status: string, title: string) => board.items.set([...board.items(), { id: `new-${board.items().length + 1}`, title, status }]);
  return (
    <Kanban id="kanban-add" class="w-full max-w-4xl">
      {COLUMNS.map((column) => (
        <Kanban.Column aria-labelledby={`kanban-add-${column.id}-title`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnTitle id={`kanban-add-${column.id}-title`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount id={`kanban-add-${column.id}-count`}>{board.itemsOf(column.id).length}</Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={column.id} onDropped={board.onDropped}>
              <For each={() => board.itemsOf(column.id)} by={(task) => task.id}>
                {(task) => (
                  <Kanban.Card data={task().id} textValue={task().title}>
                    <Kanban.CardContent>{task().title}</Kanban.CardContent>
                  </Kanban.Card>
                )}
              </For>
            </Kanban.CardList>
            <KanbanComposer id={`kanban-add-${column.id}`} onSubmit={(title) => add(column.id, title)} />
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
      <Composer />
    </div>
  );
}
