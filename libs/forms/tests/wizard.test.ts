// Wizards: client state (guards, URL helpers) and the server step pipeline over an in-memory DraftStore.
import { test } from "vitest";
import assert from "node:assert/strict";
import { untrack } from "@rivetjs/reactivity";
import { z } from "zod";
import { createHandler, type AppRoute, type RenderInput, type ServerModule } from "../../router/server/handler.ts";
import { redirect } from "@rivetjs/router";
import { defineForm } from "../index.ts";
import { back, createWizard, defineWizard, goTo, isComplete, next, step, stepFromUrl, stepHref, type Draft, type DraftStore, type WizardDraft } from "../wizard.ts";
import { loadWizard, wizardAction } from "../server/index.ts";

const account = defineForm({ name: "account", schema: z.object({ email: z.string().email() }) });
const address = defineForm({ name: "address", schema: z.object({ city: z.string().min(1) }) });
const confirm = defineForm({ name: "confirm", schema: z.object({ agree: z.literal(true) }), coerce: { agree: "boolean" } });
const onboarding = defineWizard({
  id: "onboarding",
  steps: [account, address, confirm],
  final: z.object({ email: z.string(), city: z.string().refine((city) => city !== "Nowhere", "errors.city") }).passthrough(),
});

function memoryDrafts(): DraftStore<WizardDraft> & { map: Map<string, Draft<WizardDraft>> } {
  const map = new Map<string, Draft<WizardDraft>>();
  return {
    map,
    load: (id) => map.get(id),
    save: (id, patch, { version }) => {
      const current = map.get(id);
      if (current && current.version !== version) return { ok: false, conflict: true, version: current.version, value: current.value };
      const nextVersion = (Number(current?.version ?? 0) + 1);
      map.set(id, { value: { ...(current?.value ?? { steps: {}, completed: [] }), ...patch } as WizardDraft, version: nextVersion });
      return { ok: true, version: nextVersion };
    },
    delete: (id) => void map.delete(id),
  };
}

test("client wizard: next/back/goTo guard, URL helpers", () => {
  const state = createWizard(onboarding, { step: 2, completed: ["account"] });
  assert.equal(untrack(state.s), 1); // cannot land past the first incomplete step
  assert.equal(goTo(onboarding, state, 2), false);
  next(onboarding, state);
  assert.equal(untrack(state.s), 2);
  assert.equal(isComplete(state, 1), true);
  back(state);
  assert.equal(step(state), 1);
  assert.equal(goTo(onboarding, state, 0), true);
  assert.equal(stepFromUrl(onboarding, "http://x/w?step=address"), 1);
  assert.equal(stepFromUrl(onboarding, "http://x/w?step=bogus"), 0);
  assert.equal(stepHref(onboarding, "http://x/w?step=account&keep=1", 2, { draft: "abcdefgh" }), "/w?step=confirm&keep=1&draft=abcdefgh");
  assert.throws(() => defineWizard({ id: "dup", steps: [account, account] }), TypeError);
});

test("server wizard: step outputs saved, redirects, skip guard, final schema, completion", async () => {
  const drafts = memoryDrafts();
  let completed: unknown;
  const actions = wizardAction(onboarding, drafts, {
    onComplete: (value) => {
      completed = value;
      return redirect("/welcome");
    },
  });
  let loaded: unknown;
  const server: ServerModule = { actions, load: async (event) => (loaded = await loadWizard(onboarding, drafts, event)) };
  const routes: AppRoute[] = [{ id: "w", pattern: "/w", page: true, layouts: [], server: () => Promise.resolve(server) }];
  const page = (input: RenderInput) => new Response(JSON.stringify({ action: input.action }), { status: input.status });
  const handler = createHandler({ routes, render: page, renderError: ({ status }) => new Response(String(status), { status }), onError: () => {} });
  // Action URLs are `?/<name>` only (the router reads the whole query as the name).
  const post = (name: string, fields: Record<string, string>) =>
    handler(new Request(`http://x/w?/${name}`, { method: "POST", body: new URLSearchParams(fields), headers: { origin: "http://x" } }));

  // Invalid step: 400 re-render, nothing saved.
  assert.equal((await post("account", { email: "nope" })).status, 400);
  assert.equal(drafts.map.size, 0);
  const first = await post("account", { email: "a@b.co" });
  assert.equal(first.status, 303);
  const location = new URL(first.headers.get("location")!, "http://x");
  assert.equal(location.pathname, "/w");
  assert.equal(location.searchParams.get("step"), "address");
  assert.equal([...location.searchParams.keys()].some((key) => key.startsWith("/")), false);
  const draft = location.searchParams.get("draft")!;
  assert.deepEqual(drafts.map.get(draft)!.value, { steps: { account: { email: "a@b.co" } }, completed: ["account"] });

  // The page load resolves the draft and clamps the step.
  await handler(new Request(`http://x/w?step=confirm&draft=${draft}`));
  assert.deepEqual(loaded, { step: 1, completed: ["account"], draft, values: { account: { email: "a@b.co" } } });

  // Skipping a step redirects back to it.
  const skipped = await post("confirm", { agree: "on", _draft: draft });
  assert.equal(new URL(skipped.headers.get("location")!, "http://x").searchParams.get("step"), "address");

  assert.equal((await post("address", { city: "Nowhere", _draft: draft })).status, 303);
  // The final schema checks the merged value.
  const final = await post("confirm", { agree: "on", _draft: draft });
  assert.equal(final.status, 400);
  assert.deepEqual(JSON.parse(await final.text()).action.result.form, [{ key: "errors.city" }]);
  assert.equal((await post("address", { city: "Kyiv", _draft: draft })).status, 303);
  const done = await post("confirm", { agree: "on", _draft: draft });
  assert.equal(done.status, 303);
  assert.equal(done.headers.get("location"), "/welcome");
  assert.deepEqual(completed, { email: "a@b.co", city: "Kyiv", agree: true });
  assert.equal(drafts.map.has(draft), false);
});
