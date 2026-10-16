import type { AppServices, Item } from "../context.js";

const items: readonly Item[] = [
  { id: "1", title: "Owned rendering", description: "Each request and mounted region owns its work and cleanup." },
  { id: "2", title: "Explicit async", description: "Async work receives cancellation and a captured service context." },
  {
    id: "3",
    title: "Targeted routing",
    description: "The same route view compiles for server output or browser updates.",
  },
];

/** Create uncached seeded services. Every result is independent and cancellation is checked after async work. */
export function createServerServices(): AppServices {
  return {
    async list(signal) {
      signal?.throwIfAborted();
      await Promise.resolve();
      signal?.throwIfAborted();
      return items.map((item) => ({ ...item }));
    },
    async detail(id, signal) {
      signal?.throwIfAborted();
      await Promise.resolve();
      signal?.throwIfAborted();
      const item = items.find((item) => item.id === id);
      return item ? { ...item } : null;
    },
  };
}
