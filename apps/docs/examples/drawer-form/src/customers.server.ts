// In-memory data for the example (one server process). Server-only: `.server.ts` never reaches the browser.
export type Customer = { id: number; name: string; email: string };

export const customers: Customer[] = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];
