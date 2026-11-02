// Wizard drafts across sessions (r3-testgaps#12): a DraftStore scoped to the session (the documented contract:
// "scope ids to the user/session in load/save") never hands one visitor's draft to another, and the completed steps
// come from the stored draft only: a forged `completed` field in the POST does not unlock a later step.
import { test } from "vitest";
import assert from "node:assert/strict";
import { z } from "zod";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../../router/server/handler.ts";
import { redirect } from "@rivetjs/router";
import { defineForm } from "../index.ts";
import { defineWizard, type Draft, type DraftStore, type WizardDraft } from "../wizard.ts";
import { loadWizard, wizardAction } from "../server/index.ts";

const account = defineForm({ name: "account", schema: z.object({ email: z.string().email() }) });
const address = defineForm({ name: "address", schema: z.object({ city: z.string().min(1) }) });
const confirm = defineForm({ name: "confirm", schema: z.object({ agree: z.literal(true) }), coerce: { agree: "boolean" } });
const onboarding = defineWizard({ id: "onboarding", steps: [account, address, confirm] });

/** In-memory drafts keyed by session (the `sid` cookie) + id, as an app scopes them. */
function sessionDrafts(): DraftStore<WizardDraft> & { map: Map<string, Draft<WizardDraft>> } {
  const map = new Map<string, Draft<WizardDraft>>();
  const key = (id: string, event: unknown) => (event as { request: Request }).request.headers.get("cookie") + "|" + id;
  return {
    map,
    load: (id, event) => map.get(key(id, event)),
    save: (id, patch, { version }, event) => {
      const current = map.get(key(id, event));
      if (current && current.version !== version) return { ok: false, conflict: true, version: current.version, value: current.value };
      const next = Number(current?.version ?? 0) + 1;
      map.set(key(id, event), { value: { ...(current?.value ?? { steps: {}, completed: [] }), ...patch } as WizardDraft, version: next });
      return { ok: true, version: next };
    },
    delete: (id, event) => void map.delete(key(id, event)),
  };
}

function app() {
  const drafts = sessionDrafts();
  let completed: unknown;
  const server: ServerModule = {
    actions: wizardAction(onboarding, drafts, { onComplete: (value) => ((completed = value), redirect("/done")) }),
    load: (event) => loadWizard(onboarding, drafts, event),
  };
  const routes: AppRoute[] = [{ id: "w", pattern: "/w", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const handler = createHandler({
    routes,
    render: (input: RenderInput) => new Response(JSON.stringify(input.data), { status: input.status }),
    renderError: ({ status, message }) => new Response(`${status} ${message}`, { status }),
    onError: () => {},
  });
  const post = (sid: string, name: string, fields: Record<string, string>) =>
    handler(new Request(`http://x/w?/${name}`, { method: "POST", body: new URLSearchParams(fields), headers: { origin: "http://x", cookie: "sid=" + sid } }));
  const get = (sid: string, url: string) => handler(new Request(url, { headers: { cookie: "sid=" + sid } }));
  return { drafts, post, get, completed: () => completed };
}

test("another session's draft id is unknown to this session: 404 for a later step, a fresh start otherwise, nothing leaks", async () => {
  const { post, get } = app();
  const first = await post("alice", "account", { email: "alice@example.com" });
  const draft = new URL(first.headers.get("location")!, "http://x").searchParams.get("draft")!;
  const own = await get("alice", `http://x/w?step=address&draft=${draft}`);
  assert.match(await own.text(), /alice@example\.com/);
  const stolen = await get("mallory", `http://x/w?step=address&draft=${draft}`);
  assert.equal(stolen.status, 404);
  assert.doesNotMatch(await stolen.text(), /alice@example\.com/);
  const fresh = await get("mallory", `http://x/w?draft=${draft}`);
  assert.equal(fresh.status, 200);
  const data = await fresh.text();
  assert.doesNotMatch(data, /alice@example\.com/);
  assert.equal(JSON.parse(data)[0].step, 0);
  // Posting a later step with alice's draft id from mallory's session neither reads nor completes alice's wizard.
  const hijack = await post("mallory", "address", { city: "Kyiv", _draft: draft });
  assert.notEqual(hijack.status, 500);
  const after = await get("alice", `http://x/w?step=address&draft=${draft}`);
  assert.doesNotMatch(await after.text(), /Kyiv/);
});

test("a forged completed field does not unlock a later step: completion comes from the stored draft", async () => {
  const { post, completed } = app();
  const first = await post("alice", "account", { email: "alice@example.com" });
  const draft = new URL(first.headers.get("location")!, "http://x").searchParams.get("draft")!;
  for (const forged of [{ completed: "account,address" }, { "completed[]": "address" }, { _completed: "0,1" }]) {
    const skipped = await post("alice", "confirm", { agree: "on", _draft: draft, ...forged });
    assert.equal(skipped.status, 303);
    assert.equal(new URL(skipped.headers.get("location")!, "http://x").searchParams.get("step"), "address", JSON.stringify(forged));
  }
  assert.equal(completed(), undefined);
});
