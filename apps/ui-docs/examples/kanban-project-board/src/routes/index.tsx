// Rivet-authored Kanban demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { CircleAlert, Plus } from "lucide";

export const head = { title: "Kanban: Project Board" };

// #region demo
type Task = { id: string; title: string; status: string; owner: string; points: number; urgent?: boolean };

const COLUMNS = [
  { id: "todo", title: "To do", color: "var(--muted)" },
  { id: "doing", title: "Doing", color: "var(--accent)" },
  { id: "done", title: "Done", color: "var(--success)" },
];

const TASKS: Task[] = [
  { id: "p1", title: "Set up the staging database", status: "todo", owner: "MK", points: 3, urgent: true },
  { id: "p2", title: "Invoice PDF export", status: "todo", owner: "JR", points: 5 },
  { id: "p3", title: "Rate-limit the public API", status: "doing", owner: "AL", points: 8 },
  { id: "p4", title: "Upgrade the image pipeline", status: "doing", owner: "MK", points: 2 },
];

export function ProjectBoard() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  return (
    <Kanban id="kanban-project-board" class="w-full max-w-5xl">
      {COLUMNS.map((column) => (
        <Kanban.Column aria-labelledby={`kanban-project-board-${column.id}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator color={column.color} />
            <Kanban.ColumnTitle id={`kanban-project-board-${column.id}`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount>{board.itemsOf(column.id).length}</Kanban.ColumnCount>
            <Kanban.ColumnActions>
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Add a task to ${column.title}`}>
                <Icon icon={Plus} size={16} />
              </Button>
            </Kanban.ColumnActions>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={column.id} onDropped={board.onDropped} renderEmptyState={() => "Drop a task here"}>
              <For each={() => board.itemsOf(column.id)} by={(task) => task.id}>
                {(task) => (
                  <Kanban.Card data={task().id} textValue={task().title}>
                    <Kanban.CardContent>
                      <span class="flex items-start gap-2">
                        <span class="flex-1 font-medium">{task().title}</span>
                        {task().urgent ? <Icon icon={CircleAlert} size={16} class="shrink-0 text-danger" aria-label="Urgent" /> : null}
                      </span>
                      <span class="flex items-center gap-2 text-xs text-muted">
                        <Avatar size="sm" class="size-6 text-xs" aria-label={task().owner}>
                          <Avatar.Fallback>{task().owner}</Avatar.Fallback>
                        </Avatar>
                        <span class="ms-auto tabular-nums">{task().points} pts</span>
                      </span>
                    </Kanban.CardContent>
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
      <ProjectBoard />
    </div>
  );
}
