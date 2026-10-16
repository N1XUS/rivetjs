// Portal (DOM: renders into a mount target, removed on cleanup; server: nothing) and createId
// (`@rivetjs/runtime/id`: server `rv…`, browser `rvc…`, deterministic inside withIdScope).
import { test } from "vitest";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { signal } from "@rivetjs/reactivity";
import * as dom from "../dom.ts";
import { Portal as ServerPortal, renderToString } from "../server.ts";
import * as serverIds from "../id.ts";
import * as browserIds from "../id-dom.ts";

const window = new Window({ url: "http://localhost/" });
const document = window.document as unknown as Document;
Object.assign(globalThis, { document });

test("Portal renders its children into document.body (or mount) and removes them on cleanup", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const label = signal("one");
  const stop = dom.mount(() => [dom.Portal({ children: () => label() }), "in place"], container);
  assert.equal(container.textContent, "in place");
  const host = document.body.querySelector("[data-rivet-portal]")!;
  assert.ok(host, "portal host appended to body");
  assert.equal(host.textContent, "one");
  label.set("two");
  assert.equal(host.textContent, "two", "children stay reactive");
  stop();
  assert.equal(document.body.querySelector("[data-rivet-portal]"), null, "host removed on cleanup");
  const target = document.createElement("section");
  document.body.append(target);
  const stop2 = dom.mount(() => dom.Portal({ mount: target, children: "into target" }), container);
  assert.equal(target.querySelector("[data-rivet-portal]")?.textContent, "into target");
  stop2();
  assert.equal(target.children.length, 0);
});

test("server Portal renders nothing", async () => {
  assert.equal(await renderToString(["a", ServerPortal({ children: "hidden" }), "b"]), "ab");
});

test("createId: unique server ids, deterministic per withIdScope, browser ids apart", () => {
  const a = serverIds.createId(),
    b = serverIds.createId();
  assert.match(a, /^rv[0-9a-z]+$/);
  assert.notEqual(a, b);
  const scoped = () => serverIds.withIdScope("p", () => [serverIds.createId(), serverIds.createId()]);
  assert.deepEqual(scoped(), ["p0", "p1"]);
  assert.deepEqual(scoped(), ["p0", "p1"], "each scope counts from 0");
  assert.match(browserIds.createId(), /^rvc[0-9a-z]+$/);
  assert.deepEqual(browserIds.withIdScope("q", () => browserIds.createId()), "q0");
  // Nested scopes: the inner one wins, the outer continues afterwards.
  assert.deepEqual(
    serverIds.withIdScope("o", () => [serverIds.createId(), serverIds.withIdScope("i", () => serverIds.createId()), serverIds.createId()]),
    ["o0", "i0", "o1"],
  );
});
