// DOM suite for resource() (happy-dom). Run by ../resource.test.ts through the register hook.
import "../testing/happy-dom.ts";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, signal } from "@rivetjs/reactivity";
import { resource, startTransition } from "@rivetjs/runtime/dom";
import type { Resource } from "@rivetjs/runtime/dom";
import { render, flush, cleanup } from "@rivetjs/runtime/testing";
import { Api, Failing, Profile, Waiting } from "./components.tsx";

afterEach(() => cleanup());

test("loads on first use, shows loading, then the value", async () => {
  const api = new Api(),
    id = signal<number | null>(1);
  const view = render(() => <Profile id={id} api={api} />);
  assert.equal(view.html(), '<p class="profile"><b>-</b><i>pending</i><u>loading</u></p>');
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0]!.key, 1);
  assert.equal(api.calls[0]!.info.refetching, false);
  api.gates[0]!.resolve("Ada");
  await flush();
  assert.equal(view.html(), '<p class="profile"><b>Ada</b><i>ready</i><u>idle</u></p>');
});

test("a source change aborts the previous load and drops its late answer", async () => {
  const api = new Api(),
    id = signal<number | null>(1);
  const view = render(() => <Profile id={id} api={api} />);
  id.set(2);
  assert.equal(api.calls.length, 2);
  assert.equal(api.calls[0]!.info.signal.aborted, true, "the first load is aborted");
  assert.equal(api.calls[1]!.key, 2);
  api.gates[1]!.resolve("two");
  await flush();
  api.gates[0]!.resolve("one (stale)");
  await flush();
  assert.equal(view.find("b").textContent, "two");
  // A falsy source loads nothing and keeps the value.
  id.set(null);
  await flush();
  assert.equal(api.calls.length, 2);
  assert.equal(view.find("b").textContent, "two");
  assert.equal(view.find("i").textContent, "ready");
});

test("refetch reloads with the current source (refetching info, previous value); mutate sets the value locally", async () => {
  const api = new Api(),
    id = signal<number | null>(7);
  let user!: Resource<string>;
  const view = render(() => <Profile id={id} api={api} ref={(r) => (user = r)} />);
  api.gates[0]!.resolve("first");
  await flush();
  user.refetch({ reason: "manual" });
  assert.equal(api.calls.length, 2);
  assert.deepEqual(api.calls[1]!.info.refetching, { reason: "manual" });
  assert.equal(api.calls[1]!.info.value, "first");
  assert.equal(view.find("i").textContent, "refreshing");
  assert.equal(view.find("b").textContent, "first", "the value stays while reloading");
  assert.equal(user.latest(), "first");
  api.gates[1]!.resolve("second");
  await flush();
  assert.equal(view.find("b").textContent, "second");
  user.refetch();
  assert.equal(api.calls[2]!.info.refetching, true);
  assert.equal(
    user.mutate((previous) => previous + "+"),
    "second+",
  );
  await flush();
  assert.equal(view.find("b").textContent, "second+");
  api.gates[2]!.resolve("third");
  await flush();
  assert.equal(view.find("b").textContent, "third", "the load in flight still lands");
});

test("a resource is lazy and owner-bound: no load before use, abort on disposal, a late answer is ignored", async () => {
  const api = new Api();
  const root = createRoot((dispose) => {
    const user = resource((source: true, info) => api.load(source, info));
    return { user, dispose };
  });
  assert.equal(api.calls.length, 0, "nothing loads before the first use");
  assert.equal(root.value.user.loading(), true);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0]!.key, true, "the fetcher-only form gets true");
  root.dispose();
  assert.equal(api.calls[0]!.info.signal.aborted, true);
  api.gates[0]!.resolve("late");
  await flush();
  assert.equal(root.value.user.latest(), undefined);
  assert.equal(root.value.user.state(), "pending");
});

test("synchronous fetchers and initialValue", () => {
  const api = new Api();
  api.answer = (key) => "now:" + String(key);
  const root = createRoot(() => ({
    sync: resource(
      () => 3,
      (key: number, info) => api.load(key, info),
    ),
    initial: resource((_: true) => new Promise<string>(() => {}), { initialValue: "seed" }),
  }));
  assert.equal(root.value.sync(), "now:3");
  assert.equal(root.value.sync.state(), "ready");
  assert.equal(root.value.initial(), "seed");
  assert.equal(root.value.initial.state(), "refreshing");
  root.dispose();
});

test("a failed load throws from the read (ErrorBoundary); error() returns it", async () => {
  const api = new Api();
  const view = render(() => <Failing api={api} />);
  assert.equal(view.html(), '<p class="wait">wait</p>');
  api.gates[0]!.reject(new Error("down"));
  await flush();
  assert.equal(view.html(), '<p class="caught">down</p>');
  const root = createRoot(() => resource((_: true) => Promise.reject(new Error("no"))));
  root.value.loading();
  await flush();
  assert.equal((root.value.error() as Error).message, "no");
  assert.equal(root.value.state(), "errored");
  assert.throws(() => root.value(), /no/);
  root.dispose();
});

test("Suspense: the first load and an untransitioned reload show the fallback; startTransition keeps the value", async () => {
  const api = new Api(),
    id = signal<number | null>(1);
  let user!: Resource<string>;
  const view = render(() => <Waiting id={id} api={api} ref={(r) => (user = r)} />);
  assert.equal(view.html(), '<main><p class="wait">wait</p></main>');
  api.gates[0]!.resolve("one");
  await flush();
  assert.equal(view.html(), '<main><p class="profile"><b>one</b><i>ready</i><u>idle</u></p></main>');
  // A reload outside a transition: fallback again (as an Async reload below a revealed Suspense).
  id.set(2);
  await flush();
  assert.equal(view.html(), '<main><p class="wait">wait</p></main>');
  api.gates[1]!.resolve("two");
  await flush();
  assert.equal(view.find("b").textContent, "two");
  // In a transition: the shown value stays (no fallback) until the new one commits; loading() is the pending flag.
  const pending = signal(false);
  const done = startTransition(() => id.set(3), pending);
  await flush();
  assert.equal(pending(), true);
  assert.equal(view.find("b").textContent, "two");
  assert.equal(view.find("u").textContent, "loading");
  assert.equal(user.latest(), "two");
  api.gates[2]!.resolve("three");
  await done;
  await flush();
  assert.equal(pending(), false);
  assert.equal(view.find("b").textContent, "three");
  assert.equal(view.container.querySelector(".wait"), null);
});
