// Rivet-authored showcase (own content: an invented team's launch board). Drag and drop = @rivetjs/cdk/drag-drop (Angular CDK port).
import { Drag, DropList, DropListGroup } from "@rivetjs/cdk/drag-drop";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { Avatar } from "@rivetjs/ui/avatar";
import { AvatarGroup } from "@rivetjs/ui/avatar-group";
import { Button } from "@rivetjs/ui/button";
import { Chip } from "@rivetjs/ui/chip";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { TextField } from "@rivetjs/ui/textfield";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, GripVertical, MessageSquare, Plus } from "lucide";

export const head = { title: "Showcase: Kanban" };

// #region demo
type Column = "todo" | "doing" | "done";
type Task = {
  id: string;
  title: string;
  tag: string;
  tone: "accent" | "success" | "warning" | "danger" | "default";
  owner: string;
  due?: string;
  comments?: number;
  urgent?: boolean;
};

const COLUMNS: { key: Column; title: string }[] = [
  { key: "todo", title: "To do" },
  { key: "doing", title: "In progress" },
  { key: "done", title: "Done" },
];

const PEOPLE: Record<string, string> = { NB: "Nadia Brandt", KA: "Kwame Asante", TV: "Theo Varga", RL: "Rosa Lindqvist" };

const TASKS: Record<string, Task> = {
  t1: { id: "t1", title: "Approve packaging proofs", tag: "Production", tone: "warning", owner: "NB", due: "Oct 10", comments: 4, urgent: true },
  t2: { id: "t2", title: "Write gift guide copy", tag: "Marketing", tone: "accent", owner: "TV", due: "Oct 14" },
  t3: { id: "t3", title: "Size chart for the trail runner", tag: "Product", tone: "success", owner: "RL", comments: 2 },
  t4: { id: "t4", title: "Book courier for the lookbook samples", tag: "Operations", tone: "default", owner: "KA", due: "Oct 9" },
  t5: { id: "t5", title: "Lookbook shoot", tag: "Marketing", tone: "accent", owner: "KA", due: "Oct 11", comments: 7 },
  t6: { id: "t6", title: "Returns page: clearer time limits", tag: "Legal", tone: "danger", owner: "RL", comments: 3 },
  t7: { id: "t7", title: "Restock 40 halo lamps", tag: "Operations", tone: "default", owner: "TV" },
  t8: { id: "t8", title: "Pick autumn colourways", tag: "Product", tone: "success", owner: "NB", comments: 12 },
};

export default function KanbanShowcase() {
  const board = signal<Record<Column, string[]>>({ todo: ["t1", "t2", "t3", "t4"], doing: ["t5", "t6"], done: ["t7", "t8"] });
  const tasks = signal(TASKS);
  const adding = signal<Column | null>(null);
  const draft = signal("");
  const announce = signal("");

  const titleOf = (col: Column) => COLUMNS.find((c) => c.key === col)!.title;
  const move = (from: Column, fromIndex: number, to: Column, toIndex: number) => {
    const next = { todo: [...board().todo], doing: [...board().doing], done: [...board().done] };
    const [id] = next[from].splice(fromIndex, 1);
    next[to].splice(Math.max(0, Math.min(toIndex, next[to].length)), 0, id);
    board.set(next);
    announce.set(`${tasks()[id].title} moved to ${titleOf(to)}.`);
  };
  const shift = (id: string, from: Column, step: number) => {
    const to = COLUMNS[COLUMNS.findIndex((c) => c.key === from) + step].key;
    move(from, board()[from].indexOf(id), to, board()[to].length);
  };
  const add = (col: Column) => {
    const title = draft().trim();
    if (!title) return;
    const id = `n${Object.keys(tasks()).length + 1}`;
    tasks.set({ ...tasks(), [id]: { id, title, tag: "New", tone: "default", owner: "TV" } });
    board.set({ ...board(), [col]: [...board()[col], id] });
    draft.set("");
    adding.set(null);
    announce.set(`${title} added to ${titleOf(col)}.`);
  };
  const total = () => board().todo.length + board().doing.length + board().done.length;

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
        <ProgressBar id="board-progress" aria-label="Done" value={(board().done.length / total()) * 100} size="sm" class="w-full sm:w-56">
          <div class="flex justify-between text-xs text-muted">
            <Label>Done</Label>
            <span id="done-count" class="tabular-nums">
              {board().done.length} of {total()}
            </span>
          </div>
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      </header>

      <p role="status" class="sr-only">
        {announce()}
      </p>

      <DropListGroup class="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <section aria-labelledby={`col-${col.key}-title`} class="flex min-w-0 flex-col gap-3 rounded-2xl bg-default/60 p-3">
            <div class="flex items-center gap-2 px-1">
              <h2 id={`col-${col.key}-title`} class="font-semibold">
                {col.title}
              </h2>
              <Chip size="sm" variant="soft">
                <Chip.Label>{board()[col.key].length}</Chip.Label>
              </Chip>
              <div class="flex-1" />
              <Button
                id={`add-${col.key}`}
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={`Add a task to ${col.title}`}
                onPress={() => {
                  draft.set("");
                  adding.set(col.key);
                }}
              >
                <Icon icon={Plus} size={16} />
              </Button>
            </div>
            <DropList
              id={`col-${col.key}`}
              data={col.key}
              class="flex min-h-24 flex-col gap-2 rounded-xl transition-colors"
              onDropped={(e) => move(e.previousContainer.data as Column, e.previousIndex, e.container.data as Column, e.currentIndex)}
            >
              <For each={() => board()[col.key]} by={(id) => id}>
                {(id) => (
                  <Drag
                    id={`card-${id()}`}
                    data={id()}
                    class="flex cursor-grab flex-col gap-3 rounded-xl border border-separator bg-surface p-3 shadow-surface active:cursor-grabbing"
                  >
                    <div class="flex items-start gap-2">
                      <Icon icon={GripVertical} size={16} class="mt-0.5 shrink-0 text-muted" />
                      <p class="flex-1 font-medium">{tasks()[id()].title}</p>
                      {tasks()[id()].urgent ? <Icon icon={CircleAlert} size={16} class="shrink-0 text-danger" aria-label="Urgent" /> : null}
                    </div>
                    <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Chip size="sm" variant="soft" color={tasks()[id()].tone}>
                        <Chip.Label>{tasks()[id()].tag}</Chip.Label>
                      </Chip>
                      {tasks()[id()].due ? (
                        <span class="flex items-center gap-1">
                          <Icon icon={CalendarDays} size={12} />
                          {tasks()[id()].due}
                        </span>
                      ) : null}
                      {tasks()[id()].comments ? (
                        <span class="flex items-center gap-1">
                          <Icon icon={MessageSquare} size={12} />
                          {tasks()[id()].comments}
                        </span>
                      ) : null}
                      <span class="flex-1" />
                      <Avatar size="sm" class="size-6 text-[10px]" aria-label={PEOPLE[tasks()[id()].owner]}>
                        <Avatar.Fallback>{tasks()[id()].owner}</Avatar.Fallback>
                      </Avatar>
                      {/* Keyboard / touch alternative to dragging between columns. */}
                      {col.key !== "todo" ? (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          class="size-7 min-w-7"
                          aria-label={`Move to ${COLUMNS[COLUMNS.findIndex((c) => c.key === col.key) - 1].title}`}
                          onPress={() => shift(id(), col.key, -1)}
                        >
                          <Icon icon={ChevronLeft} size={14} />
                        </Button>
                      ) : null}
                      {col.key !== "done" ? (
                        <Button
                          id={`next-${id()}`}
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          class="size-7 min-w-7"
                          aria-label={`Move to ${COLUMNS[COLUMNS.findIndex((c) => c.key === col.key) + 1].title}`}
                          onPress={() => shift(id(), col.key, 1)}
                        >
                          <Icon icon={ChevronRight} size={14} />
                        </Button>
                      ) : null}
                    </div>
                  </Drag>
                )}
              </For>
            </DropList>
            {adding() === col.key ? (
              <form
                class="flex flex-col gap-2"
                onSubmit={(event: SubmitEvent) => {
                  event.preventDefault();
                  add(col.key);
                }}
              >
                <TextField aria-label="Task title" value={draft} autoFocus fullWidth>
                  <Input id={`new-${col.key}`} placeholder="What needs doing?" />
                </TextField>
                <div class="flex gap-2">
                  <Button id={`save-${col.key}`} type="submit" size="sm">
                    Add task
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => adding.set(null)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}
          </section>
        ))}
      </DropListGroup>
    </div>
  );
}
// #endregion
