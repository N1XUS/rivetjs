// Loader call counts per module (read by the tests through /counts).
export const counts: Record<string, number> = {};
export const count = (name: string): number => (counts[name] = (counts[name] ?? 0) + 1);
