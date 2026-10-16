import { clientEffect } from "@rivetjs/runtime/dom";
import { createAutosave, defineAutosave, guardLeave, onAutosave, postDraft, unsaved } from "@rivetjs/forms/autosave";
import { draftAction, type Draft, type DraftStore, type RawDraft } from "@rivetjs/forms/server";

export const head = { title: "Draft" };

// In-memory drafts for the demo (one process).
const map = new Map<string, Draft<RawDraft>>();
const store: DraftStore<RawDraft> = {
  load: (id) => map.get(id),
  save(id, patch, { version }) {
    const current = map.get(id);
    if (current && current.version !== version) return { ok: false, conflict: true, version: current.version };
    const next = String(Number(current?.version ?? 0) + 1);
    map.set(id, { value: { ...current?.value, ...patch } as RawDraft, version: next });
    return { ok: true, version: next };
  },
  delete: (id) => void map.delete(id),
};
export const serverActions = { draft: draftAction(store) };

// Long quiet period: typing leaves changes unsaved, so leaving the page asks first.
const drafts = defineAutosave({ save: postDraft("?/draft"), debounce: 60_000 });

/** Autosave with a leave guard: client navigation confirms, closing or reloading gets the browser's prompt. */
export default function DraftPage() {
  const auto = createAutosave({ draft: "demo-draft" });
  clientEffect(() => guardLeave(auto, { message: "Leave with unsaved changes?" }));
  return (
    <section>
      <h1>Draft</h1>
      <form method="post" action="?/draft" class="stack" onInput={(event) => onAutosave(drafts, auto, event)}>
        <textarea id="draft-body" name="body" aria-label="Body" class="input"></textarea>
        <p id="draft-status">{unsaved(auto) ? "Unsaved changes" : "All saved"}</p>
      </form>
      <a id="draft-leave" href="/">
        Back to the demo
      </a>
    </section>
  );
}
