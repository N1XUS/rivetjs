import { load, type RequestEvent, type PageProps } from "@rivetjs/router";
import { signal, batch } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { draftFor } from "../../server/service.server.ts";
import { userOf } from "../../server/http.server.ts";
import { request } from "../../sites/client.ts";
export const loader = load((e: RequestEvent) => ({ draft: draftFor(userOf(e)), writable: userOf(e).role !== "viewer" }));
export default function Editor({ data }: PageProps<typeof loader>) {
  const title = signal(data.draft.title),
    body = signal(data.draft.body),
    version = signal(data.draft.version),
    dirty = signal(false),
    status = signal("Saved"),
    conflict = signal(false);
  let busy = false;
  async function save() {
    if (busy || conflict() || !dirty()) return;
    busy = true;
    const sent = { title: title(), body: body(), version: version() };
    status.set("Saving");
    let failed = false;
    try {
      const next = await request<typeof data.draft>("/desk/api/draft", "PUT", sent);
      batch(() => {
        version.set(next.version);
        if (title() === sent.title && body() === sent.body) dirty.set(false);
        status.set(dirty() ? "Unsaved changes" : "Saved");
      });
    } catch (e) {
      failed = true;
      conflict.set(String(e).includes("409:"));
      status.set(String(e));
    } finally {
      busy = false;
      if (dirty() && !conflict() && !failed) queueMicrotask(() => void save());
    }
  }
  clientEffect(() => {
    title();
    body();
    if (!dirty() || conflict() || !data.writable) return;
    const timer = setTimeout(() => void save(), 500);
    return () => clearTimeout(timer);
  });
  async function reload() {
    const next = await request<typeof data.draft>("/desk/api/draft");
    batch(() => {
      title.set(next.title);
      body.set(next.body);
      version.set(next.version);
      dirty.set(false);
      conflict.set(false);
      status.set("Saved");
    });
  }
  return (
    <main>
      <header class="editor-header">
        <div>
          <p class="eyebrow">PUBLISHING / PRIVATE DRAFT</p>
          <h1>Make the next update count.</h1>
        </div>
        <span id="draft-status" role="status">
          {status()}
        </span>
      </header>
      <div class="editor-grid">
        <section>
          <label>
            Title
            <input id="draft-title" model:value={title} onInput={() => dirty.set(true)} disabled={!data.writable} />
          </label>
          <label>
            Story
            <textarea id="draft-body" model:value={body} onInput={() => dirty.set(true)} disabled={!data.writable} />
          </label>
          <button id="save-draft" disabled={!data.writable} onClick={() => void save()}>
            Save now
          </button>
          <button id="reload-draft" onClick={() => void reload()}>
            Reload saved version
          </button>
          <p>
            Revision <output id="draft-version">{version()}</output>. Changes autosave after a short pause. Conflicts keep your local text.
          </p>
        </section>
        <section class="article-preview">
          <p class="eyebrow">TEXT PREVIEW</p>
          <h2 id="preview-title">{title()}</h2>
          <p id="preview-body">{body()}</p>
        </section>
      </div>
    </main>
  );
}
