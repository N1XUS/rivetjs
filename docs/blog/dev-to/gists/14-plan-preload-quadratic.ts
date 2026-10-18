// libs/runtime/server-resume.ts — planPreload: which chunks to prefetch when the user shows intent.
// For each handler, follow its captures to the signals it can write, then to the bindings reading
// those signals, then to THEIR chunks. 1,000 rows → 1,000 handlers that all reach `selected`,
// which is read by 1,000 row bindings. O(handlers × readers). CPU/page grew ×12.4 from 100→1000 rows.

// BEFORE (2026-10-06 morning):
const follow = (refs: number[], own: number[]): number[] => {
  const signals = new Set<number>();
  reachableSymbols(table, refs, signals);
  const extra = new Set<number>();
  for (const signal of signals) for (const list of readers.get(signal) ?? []) for (const i of list) if (!own.includes(i)) extra.add(i);
  return [...extra];
};

// AFTER (commit 3cda4875): readers is a Set per signal; results memoized per (reached signals, own chunks).
// Extras per (reached signals, own chunks): row handlers reach the same signals (O(handlers), not × readers).
const followed = new Map<string, number[]>();
const follow = (refs: number[], own: number[]): number[] => {
  const signals = new Set<number>();
  reachableSymbols(table, refs, signals);
  if (!signals.size) return [];
  const key = [...signals].join() + "|" + own.join();
  let extra = followed.get(key);
  if (extra) return extra;
  const found = new Set<number>();
  for (const signal of signals) for (const i of readers.get(signal) ?? []) if (!own.includes(i)) found.add(i);
  followed.set(key, (extra = [...found]));
  return extra;
};
