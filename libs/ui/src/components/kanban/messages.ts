// Rivet addition (SHOWCASE-1 2026-10-27): screen reader texts of `Kanban onCardMove` keyboard moves (`keyboard.ts`). Its
// own module: the board renders `instructions` on the server, the move logic loads on the first key.
/** Screen reader texts of keyboard moves (`position` is 1-based). */
export interface KanbanMessages {
  /** Card description (`aria-describedby` of every card). */
  instructions: string;
  /** Card description in a selectable `.CardList` (Space selects there, so Enter picks up). */
  selectionInstructions: string;
  pickedUp: (card: string, column: string, position: number, total: number) => string;
  moved: (card: string, column: string, position: number, total: number) => string;
  dropped: (card: string, column: string, position: number, total: number) => string;
  cancelled: (card: string, column: string, position: number, total: number) => string;
}

export const KANBAN_MESSAGES: KanbanMessages = {
  instructions: "Press Space to pick up the card. Then use the arrow keys to move it, Space to drop it, Escape to cancel.",
  selectionInstructions: "Press Space to select the card, Enter to pick it up. Then use the arrow keys to move it, Enter to drop it, Escape to cancel.",
  pickedUp: (card, column, position, total) => `Picked up ${card}. ${column}, position ${position} of ${total}.`,
  moved: (card, column, position, total) => `${card}: ${column}, position ${position} of ${total}.`,
  dropped: (card, column, position, total) => `Dropped ${card} in ${column}, position ${position} of ${total}.`,
  cancelled: (card, column, position, total) => `Move cancelled. ${card} is back in ${column}, position ${position} of ${total}.`,
};
