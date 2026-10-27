// Rivet-authored showcase (own content: an invented team's launch board). Board = @rivetjs/ui/kanban (cdk drag-drop
// underneath: pointer / touch drags; keyboard moves through `onCardMove`; KanbanComposer adds cards).
import { Icon } from "@rivetjs/kit/icon";
import { For } from "@rivetjs/runtime/dom";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Chip } from "@rivetjs/ui/chip";
import { Kanban, KanbanComposer, createKanban } from "@rivetjs/ui/kanban";
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { CalendarDays, CircleAlert, MessageSquare } from "lucide";

export const head = { title: "Showcase: Kanban" };

// #region demo
type Column = "todo" | "doing" | "done";
type Task = {
  id: string;
  status: Column;
  title: string;
  tag: string;
  tone: "accent" | "success" | "warning" | "danger" | "default";
  owner: string;
  due?: string;
  comments?: number;
  urgent?: boolean;
};

const COLUMNS: { key: Column; title: string; color: string }[] = [
  { key: "todo", title: "To do", color: "var(--muted)" },
  { key: "doing", title: "In progress", color: "var(--warning)" },
  { key: "done", title: "Done", color: "var(--success)" },
];

const PEOPLE: Record<string, string> = { NB: "Nadia Brandt", KA: "Kwame Asante", TV: "Theo Varga", RL: "Rosa Lindqvist" };

const TASKS: Task[] = [
  { id: "t1", status: "todo", title: "Approve packaging proofs", tag: "Production", tone: "warning", owner: "NB", due: "Oct 10", comments: 4, urgent: true },
  { id: "t2", status: "todo", title: "Write gift guide copy", tag: "Marketing", tone: "accent", owner: "TV", due: "Oct 14" },
  { id: "t3", status: "todo", title: "Size chart for the trail runner", tag: "Product", tone: "success", owner: "RL", comments: 2 },
  { id: "t4", status: "todo", title: "Book courier for the lookbook samples", tag: "Operations", tone: "default", owner: "KA", due: "Oct 9" },
  { id: "t5", status: "doing", title: "Lookbook shoot", tag: "Marketing", tone: "accent", owner: "KA", due: "Oct 11", comments: 7 },
  { id: "t6", status: "doing", title: "Returns page: clearer time limits", tag: "Legal", tone: "danger", owner: "RL", comments: 3 },
  { id: "t7", status: "done", title: "Restock 40 halo lamps", tag: "Operations", tone: "default", owner: "TV" },
  { id: "t8", status: "done", title: "Pick autumn colourways", tag: "Product", tone: "success", owner: "NB", comments: 12 },
];

export default function KanbanShowcase() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status: status as Column }),
  });
  const add = (status: Column, title: string) =>
    board.items.set([...board.items(), { id: `n${board.items().length + 1}`, status, title, tag: "New", tone: "default", owner: "TV" }]);
  const done = () => board.itemsOf("done").length;
  const total = () => board.items().length;

  return (
    <div class="mx-auto flex max-w-6xl flex-col gap-6 p-4 text-sm sm:p-6">
      <header class="flex flex-wrap items-end gap-4">
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted">Fieldnote · Autumn drop</p>
          <h1 class="text-2xl font-semibold">Launch board</h1>
        </div>
        <AvatarGroup size="sm">
          {Object.keys(PEOPLE).map((key) => (
            <Avatar aria-label={PEOPLE[key]}>
              <Avatar.Fallback>{key}</Avatar.Fallback>
            </Avatar>
          ))}
        </AvatarGroup>
        <ProgressBar id="board-progress" aria-label="Done" value={(done() / total()) * 100} size="sm" class="w-full sm:w-56">
          <div class="flex justify-between text-xs text-muted">
            <Label>Done</Label>
            <span id="done-count" class="tabular-nums">
              {done()} of {total()}
            </span>
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </header>

      {/* Drag a card (mouse or touch), or focus it and press Space, then the arrow keys. */}
      <Kanban id="launch-board" onCardMove={board.onCardMove}>
        {COLUMNS.map((col) => (
          <Kanban.Column aria-labelledby={`col-${col.key}-title`}>
            <Kanban.ColumnHeader>
              <Kanban.ColumnIndicator color={col.color} />
              <Kanban.ColumnTitle id={`col-${col.key}-title`}>{col.title}</Kanban.ColumnTitle>
              <Kanban.ColumnCount>{board.itemsOf(col.key).length}</Kanban.ColumnCount>
            </Kanban.ColumnHeader>
            <Kanban.ColumnBody>
              <Kanban.CardList id={`col-${col.key}`} data={col.key as string} onDropped={board.onDropped} renderEmptyState={() => "Drop a task here"}>
                <For each={() => board.itemsOf(col.key)} by={(task) => task.id}>
                  {(task) => (
                    <Kanban.Card id={`card-${task().id}`} data={task().id} textValue={task().title}>
                      <Kanban.CardContent class="gap-3">
                        <span class="flex items-start gap-2">
                          <span class="flex-1 font-medium">{task().title}</span>
                          {task().urgent ? <Icon icon={CircleAlert} size={16} class="shrink-0 text-danger" aria-label="Urgent" /> : null}
                        </span>
                        <span class="flex flex-wrap items-center gap-2 text-xs text-muted">
                          <Chip size="sm" variant="soft" color={task().tone}>
                            <Chip.Label>{task().tag}</Chip.Label>
                          </Chip>
                          {task().due ? (
                            <span class="flex items-center gap-1">
                              <Icon icon={CalendarDays} size={12} />
                              {task().due}
                            </span>
                          ) : null}
                          {task().comments ? (
                            <span class="flex items-center gap-1">
                              <Icon icon={MessageSquare} size={12} />
                              {task().comments}
                            </span>
                          ) : null}
                          <Avatar size="sm" class="ms-auto size-6 text-[10px]" aria-label={PEOPLE[task().owner]}>
                            <Avatar.Fallback>{task().owner}</Avatar.Fallback>
                          </Avatar>
                        </span>
                      </Kanban.CardContent>
                    </Kanban.Card>
                  )}
                </For>
              </Kanban.CardList>
              <KanbanComposer
                id={`add-${col.key}`}
                label="Add a task"
                placeholder="What needs doing?"
                submitLabel="Add task"
                onSubmit={(title) => add(col.key, title)}
              />
            </Kanban.ColumnBody>
          </Kanban.Column>
        ))}
      </Kanban>
    </div>
  );
}
// #endregion
