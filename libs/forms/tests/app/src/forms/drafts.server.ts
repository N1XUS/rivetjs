// In-memory DraftStore for the demo (one process, lost on restart). Real apps scope drafts to the
// session and persist them (database, KV); the interface is the same.
import type { Draft, DraftStore, WizardDraft } from "@rivetjs/forms/server";

const drafts = new Map<string, Draft<WizardDraft>>();
const MAX = 1000;

export const memoryDrafts: DraftStore<WizardDraft> = {
  load: (id) => drafts.get(id),
  save(id, patch, { version }) {
    const current = drafts.get(id);
    if (current && current.version !== version) return { ok: false, conflict: true, version: current.version };
    const next = (Number(current?.version ?? 0) + 1).toString();
    if (!current && drafts.size >= MAX) drafts.delete(drafts.keys().next().value!);
    drafts.set(id, { value: { steps: {}, completed: [], ...current?.value, ...patch }, version: next });
    return { ok: true, version: next };
  },
  delete: (id) => void drafts.delete(id),
};
