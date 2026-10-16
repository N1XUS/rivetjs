// Autosave: debounce, patches, versions, conflicts, failures; the draft endpoint.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { createHandler, type AppRoute, type RenderInput } from "../../router/server/handler.ts";
import { conflict, createAutosave, defineAutosave, flush, markChanged, resolveConflict, saveError, savedVersion, saving, shouldBlockLeave, unsaved, type Patch } from "../autosave.ts";
import { draftAction, type RawDraft } from "../server/index.ts";
import type { Draft, DraftStore } from "../wizard.ts";
import { tick } from "./fixtures.ts";

function memory(): DraftStore<RawDraft> & { map: Map<string, Draft<RawDraft>> } {
  const map = new Map<string, Draft<RawDraft>>();
  return {
    map,
    load: (id) => map.get(id),
    save: (id, patch, { version }) => {
      const current = map.get(id);
      if (current && String(current.version) !== String(version)) return { ok: false, conflict: true, version: current.version, value: current.value };
      const next = String(Number(current?.version ?? 0) + 1);
      map.set(id, { value: { ...current?.value, ...patch } as RawDraft, version: next });
      return { ok: true, version: next };
    },
    delete: (id) => void map.delete(id),
  };
}

test("debounced patches carry the last version; conflicts hold changes until resolved", async () => {
  const calls: { patch: Patch; version?: unknown }[] = [];
  let answer: "ok" | "conflict" | "throw" = "ok";
  let version = 1;
  const def = defineAutosave({
    debounce: 10,
    save: async (patch, context) => {
      calls.push({ patch, version: context.version });
      if (answer === "throw") throw new Error("offline");
      if (answer === "conflict") return { ok: false, conflict: true, version: 99, value: { title: "theirs" } };
      return { ok: true, version: ++version };
    },
  });
  const state = createAutosave({ version: 1, draft: "draft-1234" });
  markChanged(def, state, "title", "a");
  markChanged(def, state, "title", "ab");
  markChanged(def, state, "body", "x");
  assert.equal(unsaved(state), true);
  assert.equal(shouldBlockLeave(state), true);
  await tick(30);
  assert.deepEqual(calls, [{ patch: { title: "ab", body: "x" }, version: 1 }]);
  assert.equal(savedVersion(state), 2);
  assert.equal(unsaved(state), false);
  assert.equal(saving(state), false);

  answer = "throw";
  markChanged(def, state, "title", "abc", true);
  await tick();
  await flush(def, state);
  assert.equal(saveError(state)?.key, "errors.save");
  assert.equal(unsaved(state), true); // kept for the next save

  answer = "conflict";
  await flush(def, state);
  assert.deepEqual(conflict(state), { version: 99, value: { title: "theirs" } });
  const before = calls.length;
  await flush(def, state); // blocked while in conflict
  assert.equal(calls.length, before);
  answer = "ok";
  await resolveConflict(def, state, 99);
  assert.equal(conflict(state), undefined);
  assert.deepEqual(calls.at(-1), { patch: { title: "abc" }, version: 99 });
  assert.equal(untrack(state.e), undefined);
});

test("draftAction: merges patches, version conflicts → 409, secrets dropped", async () => {
  const drafts = memory();
  const routes: AppRoute[] = [{ id: "d", pattern: "/d", page: true, layouts: [], server: () => Promise.resolve({ actions: { draft: draftAction(drafts) } }) }];
  const page = (input: RenderInput) => new Response(JSON.stringify({ action: input.action }), { status: input.status });
  const handler = createHandler({ routes, render: page, renderError: ({ status }) => new Response(String(status), { status }), onError: () => {} });
  const post = async (fields: Record<string, string>) => {
    const response = await handler(new Request("http://x/d?/draft", { method: "POST", body: new URLSearchParams(fields), headers: { origin: "http://x" } }));
    return { status: response.status, result: JSON.parse(await response.text()).action.result };
  };
  const first = await post({ title: "a", password: "hunter22", _draft: "draft-abcdef" });
  assert.deepEqual(first, { status: 200, result: { ok: true, version: "1", draft: "draft-abcdef" } });
  assert.deepEqual(drafts.map.get("draft-abcdef")!.value, { title: "a" });
  const second = await post({ body: "b", _draft: "draft-abcdef", _version: "1" });
  assert.equal(second.result.version, "2");
  assert.deepEqual(drafts.map.get("draft-abcdef")!.value, { title: "a", body: "b" });
  const stale = await post({ body: "c", _draft: "draft-abcdef", _version: "1" });
  assert.equal(stale.status, 409);
  assert.deepEqual(stale.result, { ok: false, conflict: true, version: "2", value: { title: "a", body: "b" } });
});
