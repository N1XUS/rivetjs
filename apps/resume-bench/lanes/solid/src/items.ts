export interface Item {
  id: number;
  label: string;
}

/**
 * Server data source. On the server it reads the shared bench data; the async memo that calls it
 * serializes the resolved value into the hydration stream, so the client memo adopts it instead of
 * calling this. The client branch (an API fetch, like a server-function RPC) only runs if no
 * serialized value exists — never during the bench page's hydration.
 */
export function loadItems(): Promise<Item[]> {
  if (import.meta.env.SSR) return import("../../../data.ts").then((m) => m.items as Item[]);
  return fetch("/api/items").then((r) => r.json());
}
