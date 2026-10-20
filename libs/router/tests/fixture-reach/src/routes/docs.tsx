import { cardTitle } from "../lib/data.ts";
import { Plain } from "../components/Plain.tsx";

// Reaches the server-only module through its own helper: a document route.
export default function Docs() {
  return (
    <main>
      <h1>{cardTitle()}</h1>
      <Plain />
    </main>
  );
}
