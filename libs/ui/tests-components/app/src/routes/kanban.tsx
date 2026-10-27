import { Icon } from "@rivetjs/kit/icon";
import { For } from "@rivetjs/runtime/dom";
import { Kanban, createKanban } from "@rivetjs/ui/kanban";
import { Circle, CircleCheck } from "lucide";

export const head = { title: "Kanban" };

type Task = { id: string; title: string; status: string };

const COLUMNS = [
  { id: "todo", title: "To do", color: "var(--chart-1)" },
  { id: "doing", title: "Doing", color: "var(--warning)" },
  { id: "done", title: "Done", color: "var(--success)" },
];

// UI-PORT S6 (Rivet addition, feature set inspired by HeroUI Pro's public Kanban docs): three connected columns, keyed
// cards from `createKanban`, an empty column state; `#kb-order` lists the board order. Nothing loads before the first press.
export default function KanbanStory() {
  const k = createKanban<Task>({
    initialItems: [
      { id: "t1", title: "Write brief", status: "todo" },
      { id: "t2", title: "Pick colours", status: "todo" },
      { id: "t3", title: "Shoot photos", status: "doing" },
    ],
    getKey: (t) => t.id,
    getColumn: (t) => t.status,
    setColumn: (t, status) => ({ ...t, status }),
  });
  return (
    <main class="flex flex-col gap-4 bg-background p-6 text-foreground">
      <Kanban id="kb" class="max-w-4xl">
        {COLUMNS.map((col) => (
          <Kanban.Column aria-labelledby={`kb-${col.id}-title`}>
            <Kanban.ColumnHeader>
              <Kanban.ColumnIndicator color={col.color}>
                {col.id === "done" ? <Icon icon={CircleCheck} size={16} /> : <Icon icon={Circle} size={16} />}
              </Kanban.ColumnIndicator>
              <Kanban.ColumnTitle id={`kb-${col.id}-title`}>{col.title}</Kanban.ColumnTitle>
              <Kanban.ColumnCount id={`kb-${col.id}-count`}>{k.itemsOf(col.id).length}</Kanban.ColumnCount>
            </Kanban.ColumnHeader>
            <Kanban.ColumnBody>
              <Kanban.CardList id={`kb-${col.id}`} data={col.id} onDropped={k.onDropped} renderEmptyState={() => "No tasks"}>
                <For each={() => k.itemsOf(col.id)} by={(t) => t.id}>
                  {(t) => (
                    <Kanban.Card id={`kb-card-${t().id}`} data={t().id} textValue={t().title}>
                      <Kanban.CardContent>{t().title}</Kanban.CardContent>
                    </Kanban.Card>
                  )}
                </For>
              </Kanban.CardList>
            </Kanban.ColumnBody>
          </Kanban.Column>
        ))}
      </Kanban>
      <p id="kb-order">
        {k
          .items()
          .map((t) => `${t.id}:${t.status}`)
          .join(" ")}
      </p>
    </main>
  );
}
