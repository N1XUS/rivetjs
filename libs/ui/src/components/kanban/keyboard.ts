// Rivet addition (SHOWCASE-1 2026-10-27): keyboard moves for `@rivetjs/ui/kanban` (the cdk drag-drop port is Angular
// CDK's pointer engine: it has no keyboard drag). Pattern = "pick up, move, drop" (react-aria / dnd-kit keyboard
// sensors): Space / Enter on a focused card picks it up, arrow keys move it (Up / Down within its column, Left / Right
// to the neighbouring column, mirrored in RTL), Space / Enter drops it, Escape puts it back where it was picked up.
// - One delegated `keydown` on the board root (`Kanban onCardMove`, in `kanban.tsx`: a synchronous guard calls
//   `preventDefault` for the handled keys, then this module loads on the first key): state lives in the DOM (root `data-kanban-grabbed` /
//   `data-kanban-from`, card `data-grabbed`), so nothing runs before the first key and a re-created card (moved to another
//   column's keyed list) is found again by its `data-kanban-key`.
// - The data move is the app's: `onCardMove({ key, column, index, from })` (`createKanban().onCardMove` = `move`).
// - Announcements go to the cdk live announcer (`@rivetjs/cdk/live-announcer`, polite), loaded on the first move.
// A `.ts` module (plain DOM code at event time; not server-rewritten).

/** A keyboard move request: put card `key` at `index` of `column` (index among that column's other cards). */
export interface KanbanCardMove {
  key: string;
  column: string;
  index: number;
  /** Where the card was before this step. */
  from: { column: string; index: number };
}

import { KANBAN_MESSAGES } from "./messages.ts";
import type { KanbanMessages } from "./messages.ts";

const CARD = '[data-slot="kanban-card"]';
const LIST = '[data-slot="kanban-card-list"]';

const listsOf = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(LIST)).filter((l) => l.closest('[data-slot="kanban"]') === root);
const cardsOf = (list: HTMLElement) => Array.from(list.children).filter((c): c is HTMLElement => (c as HTMLElement).matches?.(CARD) === true);
const cardIn = (root: HTMLElement, key: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(CARD)).find((c) => c.dataset.kanbanKey === key && c.closest('[data-slot="kanban"]') === root);
const columnName = (list: HTMLElement) =>
  list.closest('[data-slot="kanban-column"]')?.querySelector('[data-slot="kanban-column-title"]')?.textContent?.trim() || (list.dataset.kanbanColumn ?? "");

function where(root: HTMLElement, key: string) {
  const card = cardIn(root, key);
  const list = card?.closest<HTMLElement>(LIST);
  if (!card || !list) return undefined;
  const cards = cardsOf(list);
  return { card, list, column: list.dataset.kanbanColumn ?? "", index: cards.indexOf(card), total: cards.length };
}

function say(message: string) {
  void import("@rivetjs/cdk/live-announcer").then((m) => m.announce(message, "polite"));
}

function release(root: HTMLElement) {
  const key = root.dataset.kanbanGrabbed;
  delete root.dataset.kanbanGrabbed;
  delete root.dataset.kanbanFrom;
  if (key) cardIn(root, key)?.removeAttribute("data-grabbed");
}

/** After the app re-rendered the board: focus the moved card again, keep it picked up, announce. */
function settle(root: HTMLElement, key: string, text: (card: string, column: string, position: number, total: number) => string, keepGrab: boolean) {
  root.dataset.kanbanMoving = "";
  setTimeout(() => {
    delete root.dataset.kanbanMoving;
    const at = where(root, key);
    if (!at) return release(root);
    // Still picked up (a drop / Escape may have run in between: keys load this module asynchronously).
    if (keepGrab && root.dataset.kanbanGrabbed === key) at.card.setAttribute("data-grabbed", "");
    if (document.activeElement !== at.card) at.card.focus({ preventScroll: true });
    at.card.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    say(text(at.card.getAttribute("aria-label") ?? key, columnName(at.list), at.index + 1, at.total));
  }, 0);
}

/**
 * A card key on the board root, after `kanban.tsx`'s synchronous guard (which already called `preventDefault`): this
 * module loads on the first key, so it gets plain values, not the event.
 */
export function kanbanKey(
  root: HTMLElement,
  target: HTMLElement,
  pressed: string,
  onCardMove: (move: KanbanCardMove) => void,
  messages: Partial<KanbanMessages> | undefined,
): void {
  const key = target.dataset.kanbanKey;
  if (!key || target.closest('[data-slot="kanban"]') !== root) return;
  const text = { ...KANBAN_MESSAGES, ...messages };
  const grabbed = root.dataset.kanbanGrabbed === key;
  const at = where(root, key);
  if (!at) return;
  const name = target.getAttribute("aria-label") ?? key;
  if (pressed === " " || pressed === "Enter") {
    if (grabbed) {
      release(root);
      say(text.dropped(name, columnName(at.list), at.index + 1, at.total));
      return;
    }
    if (root.dataset.kanbanGrabbed) release(root);
    root.dataset.kanbanGrabbed = key;
    root.dataset.kanbanFrom = JSON.stringify({ column: at.column, index: at.index });
    target.setAttribute("data-grabbed", "");
    say(text.pickedUp(name, columnName(at.list), at.index + 1, at.total));
    return;
  }
  if (!grabbed) return;
  if (pressed === "Escape") {
    const from = JSON.parse(root.dataset.kanbanFrom ?? "null") as { column: string; index: number } | null;
    release(root);
    if (from && (from.column !== at.column || from.index !== at.index)) {
      // Before the move: outside an event batch the app re-renders inside `onCardMove`, and the card leaving its old
      // list fires `focusout` (which drops a picked-up card unless a move is in flight).
      root.dataset.kanbanMoving = "";
      onCardMove({ key, column: from.column, index: from.index, from: { column: at.column, index: at.index } });
      settle(root, key, text.cancelled, false);
    } else say(text.cancelled(name, columnName(at.list), at.index + 1, at.total));
    return;
  }
  const rtl = getComputedStyle(root).direction === "rtl";
  const step = pressed === "ArrowLeft" ? (rtl ? 1 : -1) : pressed === "ArrowRight" ? (rtl ? -1 : 1) : 0;
  const lists = listsOf(root);
  let column = at.column;
  let index = at.index;
  if (pressed === "ArrowUp") index = Math.max(0, at.index - 1);
  else if (pressed === "ArrowDown") index = Math.min(at.total - 1, at.index + 1);
  else if (step !== 0) {
    const next = lists[lists.indexOf(at.list) + step];
    if (!next) return;
    column = next.dataset.kanbanColumn ?? "";
    index = Math.min(at.index, cardsOf(next).length);
  } else return;
  if (column === at.column && index === at.index) return;
  root.dataset.kanbanMoving = "";
  onCardMove({ key, column, index, from: { column: at.column, index: at.index } });
  settle(root, key, text.moved, true);
}
