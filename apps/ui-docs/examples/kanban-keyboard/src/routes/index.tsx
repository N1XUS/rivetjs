// Rivet-authored Kanban demo (Rivet addition; keyboard moves on top of the cdk drag-drop port, own demo content).
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";

export const head = { title: "Kanban: Keyboard moves" };

// #region demo
type Task = { id: string; title: string; status: string };

const COLUMNS = [
  { id: "todo", title: "To do" },
  { id: "progress", title: "In progress" },
  { id: "done", title: "Done" },
];

const TASKS: Task[] = [
  { id: "1", title: "Write the changelog", status: "todo" },
  { id: "2", title: "Record the demo video", status: "todo" },
  { id: "3", title: "Review the docs PR", status: "progress" },
  { id: "4", title: "Ship the beta", status: "done" },
  { id: "5", title: "Book the venue", status: "done" },
];

export function KeyboardMoves() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  return (
    <Kanban id="kanban-kbd" class="w-full max-w-4xl" onCardMove={board.onCardMove}>
      {COLUMNS.map((column) => (
        <Kanban.Column aria-labelledby={`kanban-kbd-${column.id}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnTitle id={`kanban-kbd-${column.id}`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount id={`kanban-kbd-${column.id}-count`}>{board.itemsOf(column.id).length}</Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={column.id} onDropped={board.onDropped} renderEmptyState={() => "No cards"}>
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
      <KeyboardMoves />
    </div>
  );
}
