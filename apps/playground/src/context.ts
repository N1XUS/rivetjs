/** Seeded example data served by the server services. */
export interface Item {
  id: string;
  title: string;
  description: string;
}
/** Application data adapter. Cancellation stays explicit; no transport is required by the view. */
export interface AppServices {
  list(signal?: AbortSignal): Item[] | Promise<Item[]>;
  detail(id: string, signal?: AbortSignal): Item | null | Promise<Item | null>;
}
