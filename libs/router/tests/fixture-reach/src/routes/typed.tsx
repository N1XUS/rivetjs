import type { Row } from "../lib/rows.server.ts";

// Type-only import of a server-only module: no browser import.
const first: Row = { id: 1 };
export default function Typed() {
  return <h1>Typed {first.id}</h1>;
}
