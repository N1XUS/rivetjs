// Shared bench data: 1,000 deterministic rows.
export const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet"];
/** One fixture row. */
export interface Item {
  id: number;
  label: string;
}
export const items: Item[] = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, label: "Row " + (i + 1) + " " + WORDS[i % 10] }));
