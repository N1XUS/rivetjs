import { guard, deny, type RequestEvent } from "@rivetjs/router";
import { userOf } from "../../server/http.server.ts";
export const access = guard((e: RequestEvent) => {
  if (userOf(e).role !== "admin") throw deny(403, "Administrator required");
});
export default function Admin() {
  return (
    <main>
      <p class="eyebrow">ADMINISTRATION</p>
      <h1>Workspace administration</h1>
      <section id="admin-panel">
        <h2>Team permissions</h2>
        <p>Only administrators can view this panel. Role changes are intentionally unavailable in this local fixture.</p>
      </section>
    </main>
  );
}
