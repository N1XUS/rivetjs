// Shared page data (every lane renders the same markup from it): 1000 list rows, 12 chart values, one month for the
// picker. Deterministic (seeded LCG), so every lane and every run renders byte-identical text.
let seed = 42;
const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const WORDS = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima"];

export interface Row {
  id: number;
  label: string;
  value: number;
}
export const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  label: WORDS[Math.floor(next() * WORDS.length)]! + " " + WORDS[Math.floor(next() * WORDS.length)]!,
  value: Math.floor(next() * 1000),
}));
export const series: number[] = Array.from({ length: 12 }, () => 10 + Math.floor(next() * 90));
export const MONTH = { year: 2026, month: 10, days: 31, firstWeekday: 3 };
