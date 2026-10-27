// Server-target suite (UI-PORT S6 Kanban; Rivet addition, feature set inspired by HeroUI Pro's public Kanban docs,
// independent implementation): board / column / card markup on the cdk drag-drop components (group, lists, drags, handle,
// placeholder template), size classes, indicator dot vs icon, empty state, and `createKanban` moves (within a column,
// across columns, clamped index, `setColumn` / `onMove`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Kanban, createKanban } from "../src/components/kanban/index.ts";

type Task = { id: string; status: string };

const board = () =>
  createKanban<Task>({
    initialItems: [
      { id: "a", status: "todo" },
      { id: "b", status: "todo" },
      { id: "c", status: "done" },
    ],
    getKey: (t) => t.id,
    getColumn: (t) => t.status,
    setColumn: (t, status) => ({ ...t, status }),
  });

test("kanban SSR: board, columns, lists, cards, handle, indicator, empty", async () => {
  const k = board();
  const html = await renderToString(() => (
    <Kanban size="sm" id="kb">
      {["todo", "done", "later"].map((col) => (
        <Kanban.Column aria-labelledby={`t-${col}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnIndicator color="red" />
            <Kanban.ColumnTitle id={`t-${col}`}>{col}</Kanban.ColumnTitle>
            <Kanban.ColumnCount>{k.itemsOf(col).length}</Kanban.ColumnCount>
            <Kanban.ColumnActions>
              <button type="button">+</button>
            </Kanban.ColumnActions>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={col} onDropped={k.onDropped} renderEmptyState={() => "No tasks"}>
              {k.itemsOf(col).map((t) => (
                <Kanban.Card data={t.id} textValue={`Task ${t.id}`}>
                  <Kanban.CardContent>{t.id}</Kanban.CardContent>
                  <Kanban.DragHandle />
                </Kanban.Card>
              ))}
            </Kanban.CardList>
          </Kanban.ColumnBody>
        </Kanban.Column>
      ))}
    </Kanban>
  ));
  assert.match(html, /<div data-size="sm" data-slot="kanban" id="kb" class="kanban kanban--sm"/);
  assert.match(html, /data-rv-drop-list-group/);
  assert.equal((html.match(/class="cdk-drop-list kanban__card-list"/g) ?? []).length, 3);
  assert.equal((html.match(/class="cdk-drag kanban__card"/g) ?? []).length, 3);
  assert.match(html, /class="kanban__card-group" role="group" aria-label="Task a"/);
  assert.match(html, /kanban__column-indicator"[^>]*style="--kanban-column-color:red"/);
  assert.doesNotMatch(html, /kanban__column-indicator"[^>]*data-icon/);
  assert.match(html, /<h3 class="kanban__column-title"/);
  assert.match(html, /kanban__column-count[^>]*>2</);
  assert.match(html, /kanban__drag-handle[^]*?<svg[^>]*aria-label="Drag"/);
  assert.match(html, /data-rv-drag-handle/);
  assert.match(html, /<svg[^>]*role="img" aria-label="Drag"/);
  assert.equal((html.match(/class="kanban__empty"/g) ?? []).length, 3);
});

test("createKanban: move within, across, clamped; onDropped", () => {
  const moves: string[] = [];
  const k = createKanban<Task>({
    initialItems: [
      { id: "a", status: "todo" },
      { id: "b", status: "todo" },
      { id: "c", status: "done" },
    ],
    getKey: (t) => t.id,
    getColumn: (t) => t.status,
    setColumn: (t, status) => ({ ...t, status }),
    onMove: (t, col, i) => moves.push(`${t.id}>${col}@${i}`),
  });
  k.move("a", "todo", 1);
  assert.deepEqual(
    k.itemsOf("todo").map((t) => t.id),
    ["b", "a"],
  );
  k.move("b", "done", 0);
  assert.deepEqual(
    k.itemsOf("done").map((t) => t.id),
    ["b", "c"],
  );
  k.move("a", "done", 99);
  assert.deepEqual(
    k.itemsOf("done").map((t) => t.id),
    ["b", "c", "a"],
  );
  k.onDropped({ item: { data: "c" }, container: { data: "later" }, currentIndex: 0 } as never);
  assert.deepEqual(
    k.itemsOf("later").map((t) => t.id),
    ["c"],
  );
  assert.deepEqual(moves, ["a>todo@1", "b>done@0", "a>done@2", "c>later@0"]);
});
