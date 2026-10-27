// Rivet-authored Kanban demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Kanban: Notion Board" };

// #region demo
type Task = { id: string; title: string; status: string; tag: string; due?: string };

const COLUMNS = [
  { id: "idea", title: "Ideas", color: "var(--chart-3)" },
  { id: "writing", title: "Writing", color: "var(--chart-4)" },
  { id: "editing", title: "Editing", color: "var(--chart-2)" },
  { id: "published", title: "Published", color: "var(--success)" },
];

const TASKS: Task[] = [
  { id: "n1", title: "Why we moved to edge rendering", status: "idea", tag: "Engineering" },
  { id: "n2", title: "Customer story: Northwind", status: "writing", tag: "Marketing", due: "Nov 4" },
  { id: "n3", title: "Accessibility checklist", status: "writing", tag: "Design" },
  { id: "n4", title: "Q3 product recap", status: "editing", tag: "Product", due: "Oct 30" },
  { id: "n5", title: "Hiring: staff engineer", status: "published", tag: "People" },
];

export function NotionBoard() {
  const board = createKanban<Task>({
    initialItems: TASKS,
    getKey: (task) => task.id,
    getColumn: (task) => task.status,
    setColumn: (task, status) => ({ ...task, status }),
  });
  return (
    <Kanban id="kanban-notion-board" class="w-full max-w-5xl">
      {COLUMNS.map((column) => (
        <Kanban.Column aria-labelledby={`kanban-notion-board-${column.id}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator color={column.color} />
            <Kanban.ColumnTitle id={`kanban-notion-board-${column.id}`}>{column.title}</Kanban.ColumnTitle>
            <Kanban.ColumnCount>{board.itemsOf(column.id).length}</Kanban.ColumnCount>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={column.id} onDropped={board.onDropped} renderEmptyState={() => "Drop a task here"}>
              <For each={() => board.itemsOf(column.id)} by={(task) => task.id}>
                {(task) => (
                  <Kanban.Card data={task().id} textValue={task().title}>
                    <Kanban.CardContent>
                      <span class="font-medium">{task().title}</span>
                      <span class="flex items-center gap-2 text-xs text-muted">
                        <Chip size="sm" variant="soft">
                          <Chip.Label>{task().tag}</Chip.Label>
                        </Chip>
                        {task().due ? <span>{task().due}</span> : null}
                      </span>
                    </Kanban.CardContent>
                    <Kanban.DragHandle />
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
      <NotionBoard />
    </div>
  );
}
