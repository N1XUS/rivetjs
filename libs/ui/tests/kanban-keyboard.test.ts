// Keyboard move module on plain DOM: the commit callback, and a dialog opened by a move keeps its focus.
import { afterEach, expect, test, vi } from "vitest";
import { installOverlayDom } from "./install-overlay-dom.ts";
import type { KanbanCardMove } from "../src/components/kanban/keyboard.ts";

installOverlayDom();

const { kanbanKey } = await import("../src/components/kanban/keyboard.ts");

const board = () => {
  document.body.innerHTML = `<div data-slot="kanban" id="root">
    <ul data-slot="kanban-card-list" data-kanban-column="a"><li data-slot="kanban-card" data-kanban-key="1" tabindex="0" aria-label="One"></li><li data-slot="kanban-card" data-kanban-key="2" tabindex="0" aria-label="Two"></li></ul>
    <ul data-slot="kanban-card-list" data-kanban-column="b"></ul>
  </div><button id="out"></button>`;
  const root = document.getElementById("root")!;
  const card = root.querySelector<HTMLElement>('[data-kanban-key="1"]')!;
  return { root, card };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => void (document.body.innerHTML = ""));

test("onCardDrop reports the whole move once, on drop only; a drop where it started and Escape report nothing", async () => {
  const { root, card } = board();
  const drops: KanbanCardMove[] = [];
  const move = (m: KanbanCardMove) => {
    const list = document.querySelector(`[data-kanban-column="${m.column}"]`)!;
    list.insertBefore(card, list.children[m.index] ?? null);
  };
  const press = (key: string) => kanbanKey(root, card, key, move, undefined, (m) => drops.push(m));
  press(" ");
  press(" ");
  expect(drops).toEqual([]);
  press(" ");
  press("ArrowRight");
  await tick();
  press("Escape");
  await tick();
  expect(drops).toEqual([]);
  press(" ");
  press("ArrowRight");
  await tick();
  expect(drops).toEqual([]);
  press(" ");
  expect(drops).toEqual([{ key: "1", column: "b", index: 0, from: { column: "a", index: 0 } }]);
});

test("a move that opened a dialog does not take focus back", async () => {
  const { root, card } = board();
  card.focus();
  const move = vi.fn((m: KanbanCardMove) => {
    document.querySelector(`[data-kanban-column="${m.column}"]`)!.insertBefore(card, null);
    const dialog = document.createElement("div");
    dialog.setAttribute("data-rv-contain", "");
    document.body.append(dialog);
  });
  kanbanKey(root, card, " ", move, undefined);
  kanbanKey(root, card, "ArrowRight", move, undefined);
  document.getElementById("out")!.focus();
  await tick();
  expect(move).toHaveBeenCalledOnce();
  expect(document.activeElement?.id).toBe("out");
  expect(root.dataset.kanbanGrabbed).toBe(undefined);
});

test("without a dialog the moved card gets focus back", async () => {
  const { root, card } = board();
  const move = (m: KanbanCardMove) => document.querySelector(`[data-kanban-column="${m.column}"]`)!.insertBefore(card, null);
  card.focus();
  kanbanKey(root, card, " ", move, undefined);
  kanbanKey(root, card, "ArrowRight", move, undefined);
  await tick();
  expect(document.activeElement).toBe(card);
  expect(card.hasAttribute("data-grabbed")).toBe(true);
});
