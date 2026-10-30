import { load, type RequestEvent, type PageProps } from "@rivetjs/router";
import { ticketsFor } from "../../server/service.server.ts";
import { userOf } from "../../server/http.server.ts";
import { For } from "@rivetjs/runtime/dom";
export const loader = load((e: RequestEvent) => ({
  tickets: ticketsFor(userOf(e), e.url.searchParams.get("q") ?? "", e.url.searchParams.get("status") ?? "all"),
  q: e.url.searchParams.get("q") ?? "",
  status: e.url.searchParams.get("status") ?? "all",
}));
export const head = { title: "Inbox · Casework" };
export default function Inbox({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <p class="eyebrow">TEAM INBOX</p>
      <h1>Good support starts here.</h1>
      <p>Requests from your organization, with shared context and clear ownership.</p>
      <form class="filter-bar" method="get">
        <label>
          Search requests
          <input id="ticket-search" name="q" value={data.q} />
        </label>
        <label>
          Status
          <select name="status" value={data.status}>
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <button>Filter</button>
      </form>
      <div class="ticket-list">
        <For each={data.tickets} by={(t) => t.id}>
          {(t) => (
            <a class="ticket-card" data-ticket={t().id} href={`/desk/tickets/${t().id}`}>
              <span class="status-pill">{t().status}</span>
              <h2>{t().title}</h2>
              <span>
                {t().id} · revision {t().version}
              </span>
            </a>
          )}
        </For>
      </div>
      {!data.tickets.length ? <p id="no-tickets">No matching requests.</p> : null}
    </main>
  );
}
