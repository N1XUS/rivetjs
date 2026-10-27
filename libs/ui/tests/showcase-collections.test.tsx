// DOM-target suite (SHOWCASE-1 2026-10-27, Rivet additions): ItemCardGroupCollection on the cdk GridList (grid /
// rows, selection signal, live isCurrent + a conditional indicator slot, empty state; a static group stays a plain role=group), ItemCard
// Indicator, Kanban keyboard moves (pick up / move across columns / drop / Escape restore, focus kept on the moved card)
// and KanbanComposer (open, submit, Escape), Sidebar.Provider contained.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { For } = await import("@rivetjs/runtime/dom");
const { ItemCard } = await import("../src/components/item-card/index.ts");
const { ItemCardGroup } = await import("../src/components/item-card-group/index.ts");
const { ItemCardGroupCollection } = await import("../src/components/item-card-group-collection/index.ts");
const { Kanban, KanbanComposer, createKanban } = await import("../src/components/kanban/index.ts");
const { Sidebar } = await import("../src/components/sidebar/index.ts");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const KeyboardEventCtor = (globalThis as unknown as { window: { KeyboardEvent: typeof KeyboardEvent } }).window.KeyboardEvent;
const key = (el: Element, k: string) => el.dispatchEvent(new KeyboardEventCtor("keydown", { key: k, bubbles: true, cancelable: true }));
// Kanban keyboard moves load `keyboard.ts` on the first key: press, then let the import + move settle.
const press = async (el: Element, k: string) => {
  const ev = new KeyboardEventCtor("keydown", { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  return ev;
};

test("item card group: static group stays a plain role=group (no grid, no rows)", () => {
  const r = render(() => (
    <ItemCardGroup aria-label="Static">
      <ItemCard>
        <ItemCard.Content>
          <ItemCard.Title>A</ItemCard.Title>
        </ItemCard.Content>
      </ItemCard>
    </ItemCardGroup>
  ));
  const root = r.container.querySelector("[data-slot=item-card-group]")!;
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(r.container.querySelector("[role=grid], [role=row]"), null);
  r.unmount();
});

test("item card group: collection mode = grid of rows with selection, unread, current and indicator", async () => {
  const selected = signal<"all" | Set<string | number>>(new Set(["b"]));
  const unread = signal(new Set(["a"]));
  const r = render(() => (
    <ItemCardGroupCollection aria-label="Inbox" selectionMode="single" selectedKeys={selected}>
      {["a", "b"].map((id) => (
        <ItemCard id={id} textValue={`Message ${id}`} isCurrent={() => id === "b"}>
          <ItemCard.Content>
            <ItemCard.Title class={unread().has(id) ? "font-semibold" : undefined}>{id}</ItemCard.Title>
          </ItemCard.Content>
          <ItemCard.Action>{unread().has(id) ? <ItemCard.Indicator aria-label="Unread" /> : null}</ItemCard.Action>
        </ItemCard>
      ))}
    </ItemCardGroupCollection>
  ));
  const grid = r.container.querySelector("[data-slot=item-card-group]")!;
  assert.equal(grid.getAttribute("role"), "grid");
  assert.match(grid.className, /item-card-group--list/);
  const rows = [...grid.querySelectorAll("[role=row]")];
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.classList.contains("item-card")));
  const a = grid.querySelector('[data-key="a"]')!;
  const b = grid.querySelector('[data-key="b"]')!;
  assert.ok(a.querySelector("[data-slot=item-card-indicator]"));
  assert.equal(b.querySelector("[data-slot=item-card-indicator]"), null);
  assert.equal(b.getAttribute("aria-current"), "true");
  assert.equal(b.getAttribute("data-current"), "true");
  assert.equal(a.getAttribute("aria-current"), null);
  assert.equal(b.getAttribute("aria-selected"), "true");
  assert.equal(a.getAttribute("aria-selected"), "false");
  const dot = a.querySelector("[data-slot=item-card-indicator]")!;
  assert.equal(dot.className, "item-card__indicator");
  assert.equal(dot.getAttribute("role"), "img");
  assert.equal(dot.querySelector("[data-slot=status]")!.className, "status status--accent status--md");
  // The caller's condition updates in place.
  unread.set(new Set(["b"]));
  await tick();
  assert.equal(a.querySelector("[data-slot=item-card-indicator]"), null);
  assert.ok(b.querySelector("[data-slot=item-card-indicator]"));
  assert.match(b.querySelector("[data-slot=item-card-title]")!.className, /font-semibold/);
  selected.set(new Set(["a"]));
  await tick();
  assert.equal(a.getAttribute("aria-selected"), "true");
  r.unmount();
});

test("item card group: items + renderEmptyState", async () => {
  const items = signal([{ id: "x" }]);
  const r = render(() => (
    <ItemCardGroupCollection aria-label="Dynamic" items={items} onAction={() => {}} renderEmptyState={() => <p class="empty">Nothing</p>}>
      {(item: { id: string }) => (
        <ItemCard id={item.id} textValue={item.id}>
          <ItemCard.Content>
            <ItemCard.Title>{item.id}</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      )}
    </ItemCardGroupCollection>
  ));
  assert.equal(r.container.querySelectorAll("[role=row]").length, 1);
  assert.equal(r.container.querySelector(".empty"), null);
  items.set([]);
  await tick();
  assert.equal(r.container.querySelectorAll('[role=row][data-key="x"]').length, 0);
  assert.match(r.container.textContent ?? "", /Nothing/);
  r.unmount();
});

type Task = { id: string; status: string; title: string };

const Board = (props: { onMove?: (key: string, column: string, index: number) => void }) => {
  const board = createKanban<Task>({
    initialItems: [
      { id: "1", status: "todo", title: "One" },
      { id: "2", status: "todo", title: "Two" },
      { id: "3", status: "done", title: "Three" },
    ],
    getKey: (t) => t.id,
    getColumn: (t) => t.status,
    setColumn: (t, status) => ({ ...t, status }),
    onMove: (t, column, index) => props.onMove?.(t.id, column, index),
  });
  return (
    <Kanban id="kb" onCardMove={board.onCardMove}>
      {["todo", "done"].map((col) => (
        <Kanban.Column aria-labelledby={`t-${col}`}>
          <Kanban.ColumnHeader>
            <Kanban.ColumnTitle id={`t-${col}`}>{col}</Kanban.ColumnTitle>
          </Kanban.ColumnHeader>
          <Kanban.ColumnBody>
            <Kanban.CardList data={col} onDropped={board.onDropped}>
              <For each={() => board.itemsOf(col)} by={(t: Task) => t.id}>
                {(t: () => Task) => (
                  <Kanban.Card data={t().id} textValue={t().title}>
                    <Kanban.CardContent>{t().title}</Kanban.CardContent>
                  </Kanban.Card>
                )}
              </For>
            </Kanban.CardList>
            <KanbanComposer id={`add-${col}`} onSubmit={(title) => board.items.set([...board.items(), { id: title, status: col, title }])} />
          </Kanban.ColumnBody>
        </Kanban.Column>
      ))}
    </Kanban>
  );
};

test("kanban: onCardMove makes cards focusable, described, keyed", () => {
  const r = render(() => <Board />);
  const card = r.container.querySelector<HTMLElement>('[data-kanban-key="1"]')!;
  assert.equal(card.getAttribute("tabindex"), "0");
  const describedBy = card.getAttribute("aria-describedby")!;
  assert.ok(describedBy);
  assert.match(r.container.querySelector(`[id="${describedBy}"]`)?.textContent ?? "", /Press Space to pick up/);
  assert.equal(r.container.querySelectorAll("[data-kanban-column]").length, 2);
  r.unmount();
});

test("kanban: Space picks up, ArrowRight moves to the next column, Space drops; Escape restores", async () => {
  const moves: string[] = [];
  const r = render(() => <Board onMove={(k, c, i) => moves.push(`${k}>${c}@${i}`)} />);
  const root = r.container.querySelector<HTMLElement>("#kb")!;
  const cardOf = (k: string) => r.container.querySelector<HTMLElement>(`[data-kanban-key="${k}"]`)!;
  const columnOf = (k: string) => cardOf(k).closest<HTMLElement>("[data-kanban-column]")!.dataset.kanbanColumn;
  cardOf("1").focus();
  await press(cardOf("1"), " ");
  assert.equal(root.dataset.kanbanGrabbed, "1");
  assert.ok(cardOf("1").hasAttribute("data-grabbed"));
  await press(cardOf("1"), "ArrowRight");
  await tick();
  await tick();
  assert.equal(columnOf("1"), "done");
  assert.deepEqual(moves, ["1>done@0"]);
  assert.equal(document.activeElement, cardOf("1"));
  assert.ok(cardOf("1").hasAttribute("data-grabbed"));
  await press(cardOf("1"), "ArrowDown");
  await tick();
  await tick();
  assert.deepEqual(moves, ["1>done@0", "1>done@1"]);
  await press(cardOf("1"), "Escape");
  await tick();
  await tick();
  assert.equal(columnOf("1"), "todo");
  assert.equal(root.dataset.kanbanGrabbed, undefined);
  assert.equal(cardOf("1").hasAttribute("data-grabbed"), false);
  // Pick up + drop in place: no move.
  await press(cardOf("2"), "Enter");
  await press(cardOf("2"), "Enter");
  assert.equal(root.dataset.kanbanGrabbed, undefined);
  assert.equal(moves.length, 3);
  // Space is handled synchronously (no page scroll) even before keyboard.ts loads.
  assert.equal((await press(cardOf("2"), " ")).defaultPrevented, true);
  await press(cardOf("2"), "Escape");
  assert.equal(root.dataset.kanbanGrabbed, undefined);
  // Arrow keys without a picked-up card do nothing (and keep their default).
  assert.equal((await press(cardOf("2"), "ArrowDown")).defaultPrevented, false);
  await press(cardOf("2"), "ArrowRight");
  await tick();
  assert.equal(columnOf("2"), "todo");
  r.unmount();
});

test("kanban composer: trigger opens a form, submit adds and closes, Escape closes", async () => {
  const r = render(() => <Board />);
  const trigger = r.container.querySelector<HTMLElement>("#add-todo")!;
  assert.equal(trigger.getAttribute("data-slot"), "kanban-composer-trigger");
  trigger.click();
  await tick();
  const input = r.container.querySelector<HTMLInputElement>("#add-todo-input")!;
  assert.ok(input, "field rendered");
  input.value = "Four";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  r.container.querySelector<HTMLFormElement>('[data-slot="kanban-composer-form"]')!.requestSubmit();
  await tick();
  assert.ok(r.container.querySelector('[data-kanban-column="todo"] [data-kanban-key="Four"]'));
  assert.equal(r.container.querySelector("#add-todo-input"), null);
  r.container.querySelector<HTMLElement>("#add-done")!.click();
  await tick();
  key(r.container.querySelector("#add-done-input")!, "Escape");
  await tick();
  assert.equal(r.container.querySelector("#add-done-input"), null);
  assert.ok(r.container.querySelector("#add-done"));
  r.unmount();
});

test("sidebar: Provider contained adds the contained wrapper class", () => {
  const r = render(() => (
    <Sidebar.Provider contained class="h-80">
      <Sidebar collapsible="icon">
        <Sidebar.Content />
      </Sidebar>
      <Sidebar.Inset />
    </Sidebar.Provider>
  ));
  const wrapper = r.container.querySelector("[data-slot=sidebar-wrapper]")!;
  assert.match(wrapper.className, /\bsidebar-wrapper\b/);
  assert.match(wrapper.className, /\bsidebar-wrapper--contained\b/);
  assert.match(wrapper.className, /\bh-80\b/);
  r.unmount();
  const plain = render(() => (
    <Sidebar.Provider>
      <Sidebar.Inset />
    </Sidebar.Provider>
  ));
  assert.doesNotMatch(plain.container.querySelector("[data-slot=sidebar-wrapper]")!.className, /contained/);
  plain.unmount();
});
