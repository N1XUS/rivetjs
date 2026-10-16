// Type-only imports from a `.server.ts` module pass the server-only boundary check.
import type { Secret } from "../shared.server.ts";
import { type Other } from "../shared.server.ts";

export default function About() {
  const typed: Secret | Other | null = null;
  return (
    <section>
      <h1>About{typed ? "!" : ""}</h1>
    </section>
  );
}
