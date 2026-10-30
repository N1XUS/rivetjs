import { load, notFound, type RequestEvent, type PageProps } from "@rivetjs/router";
import { signal, batch } from "@rivetjs/reactivity";
import { For, clientEffect } from "@rivetjs/runtime/dom";
import { ticketFor, messagesFor, filesFor } from "../../../server/service.server.ts";
import type { Message } from "../../../server/service.server.ts";
import { userOf } from "../../../server/http.server.ts";
import { request } from "../../../sites/client.ts";
export const loader = load((e: RequestEvent) => {
  const user = userOf(e),
    ticket = ticketFor(user, e.params.id);
  if (!ticket) throw notFound();
  return { ticket, messages: messagesFor(user, ticket.id), files: filesFor(user, ticket.id), writable: ["agent", "admin"].includes(user.role) };
});
export default function TicketPage({ data }: PageProps<typeof loader>) {
  const ticket = signal(data.ticket),
    title = signal(data.ticket.title),
    status = signal(data.ticket.status),
    messages = signal(data.messages),
    body = signal(""),
    files = signal(data.files),
    error = signal(""),
    connection = signal("Connecting"),
    saving = signal(false);
  clientEffect(() => {
    const events = new EventSource("/desk/api/events");
    events.onopen = () => connection.set("Live");
    events.onmessage = (e) => {
      const message = JSON.parse(e.data) as Message;
      if (message.ticket === ticket().id) messages.update((old) => (old.some((m) => m.id === message.id) ? old : [...old, message]));
    };
    events.onerror = () => connection.set("Reconnecting");
    return () => events.close();
  });
  async function save() {
    saving.set(true);
    try {
      ticket.set(
        await request<typeof data.ticket>("/desk/api/tickets/" + ticket().id, "PATCH", { version: ticket().version, title: title(), status: status() }),
      );
      error.set("Saved");
    } catch (e) {
      error.set(String(e));
    } finally {
      saving.set(false);
    }
  }
  async function reply(e: Event) {
    e.preventDefault();
    if (!body().trim()) return;
    try {
      const m = await request<Message>("/desk/api/messages/" + ticket().id, "POST", { body: body() });
      batch(() => {
        messages.update((old) => (old.some((x) => x.id === m.id) ? old : [...old, m]));
        body.set("");
      });
      error.set("");
    } catch (e) {
      error.set(String(e));
    }
  }
  async function upload(e: Event) {
    e.preventDefault();
    const form = new FormData(e.currentTarget as HTMLFormElement);
    form.set("ticket", ticket().id);
    const r = await fetch("/desk/api/files", { method: "POST", body: form });
    const result = await r.json();
    if (!r.ok) error.set(result.error);
    else files.update((old) => [...old, result]);
  }
  return (
    <main>
      <a href="/desk" class="text-link">
        Back to inbox
      </a>
      <header class="ticket-heading">
        <p class="eyebrow">REQUEST {ticket().id}</p>
        <h1>{ticket().title}</h1>
        <p>
          <span class="status-pill">{ticket().status}</span> revision <output id="ticket-version">{ticket().version}</output> ·{" "}
          <span id="live-connection">{connection()}</span>
        </p>
      </header>
      <div class="ticket-workspace">
        <section>
          <h2>Conversation</h2>
          <div id="messages" aria-live="polite">
            <For each={messages()} by={(m) => m.id}>
              {(m) => (
                <article class="message" data-message-id={m().id}>
                  <strong>{m().author}</strong>
                  <time>{m().created.slice(11, 16)}</time>
                  <p>{m().body}</p>
                </article>
              )}
            </For>
          </div>
          <form onSubmit={(e) => void reply(e)}>
            <label>
              Reply
              <textarea id="reply-body" model:value={body} disabled={!data.writable} />
            </label>
            <button id="send-reply" disabled={!data.writable}>
              Send reply
            </button>
          </form>
        </section>
        <section>
          <h2>Request details</h2>
          <label>
            Title
            <input id="ticket-title" model:value={title} disabled={!data.writable} />
          </label>
          <label>
            Status
            <select id="ticket-status" model:value={status} disabled={!data.writable}>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <button id="save-ticket" disabled={saving() || !data.writable} onClick={() => void save()}>
            Save changes
          </button>
          <p id="ticket-feedback" role="status">
            {error()}
          </p>
          <h2>Attachments</h2>
          <For each={files()} by={(f) => f.id}>
            {(f) => (
              <p>
                <a class="file-download" href={"/desk/api/files/" + f().id}>
                  {f().name}
                </a>
              </p>
            )}
          </For>
          <form onSubmit={(e) => void upload(e)}>
            <label>
              Add a plain-text file
              <input id="attachment" type="file" name="file" accept=".txt,.md" disabled={!data.writable} />
            </label>
            <button id="upload-file" disabled={!data.writable}>
              Upload
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
