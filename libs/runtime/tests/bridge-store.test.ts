// Function Bridge T12: captured stores ship only the paths read on the server or named literally in captured code.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createStore, read, write, at, _storePaths } from "@rivetjs/reactivity/store";
import { signal } from "@rivetjs/reactivity";
import { _rFn, _rStorePaths, renderResumable } from "@rivetjs/runtime/server-resume";
import { createDecoder } from "@rivetjs/runtime/resume-format";
import type { ResumeState } from "@rivetjs/runtime/resume-format";
import { DEV } from "#dev";
import { roundTrip } from "./resume/bridge-encode.ts";
import { compileResume, importServer } from "./resume/compile.ts";
import { readable } from "./resume/wire.ts";

const DEV_RUN = process.execArgv.includes("--conditions=development");

const custom = (kind: string, args: unknown[]) => (kind === "store" ? { ...(args[1] as object), v: args[0] } : undefined);

test("a marked store drops paths nobody reads", async () => {
  const { html, values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ count: 0, blob: "BIGDATA".repeat(50), user: { name: "ada", bio: "LONGBIO" } }), ["count"]);
      read(store, "user.name");
      return [store];
    },
    {},
    { custom },
  );
  assert.doesNotMatch(html, /BIGDATA|LONGBIO/);
  const store = values[0] as Parameters<typeof read>[0];
  assert.equal(read(store, "count" as never), 0);
  assert.equal(read(store, "user.name" as never), "ada");
  write(store, "count" as never, ((c: number) => c + 1) as never);
  assert.equal(read(store, "count" as never), 1);
});

test("a whole read on the server ships the whole store", async () => {
  const { html } = await roundTrip(() => {
    const store = _rStorePaths(createStore({ count: 0, blob: "BIGDATA" }), ["count"]);
    read(store);
    return [store];
  });
  assert.match(html, /BIGDATA/);
});

test("an unmarked store encodes as before (whole data)", async () => {
  const { html } = await roundTrip(() => {
    const store = createStore({ count: 0, blob: "BIGDATA" });
    read(store, "count");
    return [store];
  });
  assert.match(html, /BIGDATA/);
});

test("a path read whole (a view of a subtree) keeps that subtree; siblings and deeper keys elsewhere drop", async () => {
  const { html, values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ a: { x: 1, deep: { k: "KEEP" } }, b: { y: "DROPB" }, list: [{ t: "T0" }, { t: "DROPT1" }] }), ["list.0.t"]);
      read(at(store, "a"));
      return [store];
    },
    {},
    { custom },
  );
  assert.match(html, /KEEP/);
  assert.match(html, /T0/);
  assert.doesNotMatch(html, /DROPB|DROPT1/);
  const store = values[0] as Parameters<typeof read>[0];
  assert.equal(read(store, "a.deep.k" as never), "KEEP");
  assert.equal(read(store, "list.0.t" as never), "T0");
});

test("_storePaths: read paths, null after a whole read or for a view", () => {
  const store = createStore({ a: { b: 1 }, c: 2 });
  assert.deepEqual(_storePaths(store), []);
  read(store, "a.b");
  read(store, "c");
  assert.deepEqual(_storePaths(store)!.sort(), ["a.b", "c"]);
  assert.equal(_storePaths(at(store, "a")), null);
  read(store);
  assert.equal(_storePaths(store), null);
});

// Fix round 1 (T12 review F1): every mark of one store in one render adds its literal paths (two capturing sites).
test("two marks on one store: the union of their literal paths ships", async () => {
  const { html, values } = await roundTrip(
    () => {
      const store = createStore({ count: 7, user: { name: "ada", bio: "LONGBIO" } });
      _rStorePaths(store, ["count"]);
      _rStorePaths(store, ["user.name"]);
      return [store];
    },
    {},
    { custom },
  );
  assert.doesNotMatch(html, /LONGBIO/);
  const store = values[0] as Parameters<typeof read>[0];
  assert.equal(read(store, "count" as never), 7);
  assert.equal(read(store, "user.name" as never), "ada");
});

// F2: pruning copies containers, never writes into the store's data (frozen data, an ancestor read before its child).
const deepFreeze = <T extends object>(value: T): T => {
  for (const key of Object.keys(value)) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== null && typeof child === "object") deepFreeze(child);
  }
  return Object.freeze(value);
};
for (const order of [
  ["user", "user.name"],
  ["user.name", "user"],
]) {
  test(`frozen data, server reads ${order.join(" then ")}: encodes, data untouched`, async () => {
    const data = deepFreeze({ count: 0, blob: "BIGDATA", user: { name: "ada", bio: "BIO" } });
    const { html, values } = await roundTrip(
      () => {
        const store = _rStorePaths(createStore(data), ["count"]);
        for (const path of order) read(store, path as never);
        return [store];
      },
      {},
      { custom },
    );
    assert.match(html, /BIO/, "user read whole ships whole");
    assert.doesNotMatch(html, /BIGDATA/);
    assert.deepEqual(Object.keys(data.user), ["name", "bio"]);
    assert.equal(read(values[0] as Parameters<typeof read>[0], "user.bio" as never), "BIO");
  });
}
test("unfrozen data keeps its objects: pruning builds new containers", async () => {
  const user = { name: "ada", bio: "BIO" };
  const data = { user, other: 1 };
  await roundTrip(
    () => {
      const store = _rStorePaths(createStore(data), []);
      read(store, "user");
      read(store, "user.name");
      return [store];
    },
    {},
    { custom },
  );
  assert.equal(data.user, user);
  assert.deepEqual(Object.keys(user), ["name", "bio"]);
});

// F6: an index path keeps its array index (a sparse array of the original length up to it).
test("a sparse index path keeps the index", async () => {
  const { html, values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ list: ["L0", "L1", "L2", "L3", "L4", "L5", "L6"] }), ["list.5"]);
      return [store];
    },
    {},
    { custom },
  );
  assert.doesNotMatch(html, /L0|L4|L6/);
  const store = values[0] as Parameters<typeof read>[0];
  assert.equal(read(store, "list.5" as never), "L5");
  assert.equal((read(store, "list" as never) as unknown[]).length, 6);
});

// F6: a marked store inside an attempt that rolls back (an object recipe whose plain encode fails on an unregistered
// function) is encoded again by the fallback, still narrowed, and decodes.
test("rollback: a failed plain attempt holding a marked store re-encodes it narrowed", async () => {
  const OBJ = "t.tsx#T$obj";
  const { html, values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ count: 3, blob: "BIGDATA" }), ["count"]);
      const holder = _rFn(OBJ, { store, run: () => 1 }, [store]);
      return [holder];
    },
    { [OBJ]: ((store: unknown) => ({ store, rebuilt: true })) as never },
    { custom },
  );
  assert.doesNotMatch(html, /BIGDATA/);
  const holder = values[0] as { store: Parameters<typeof read>[0]; rebuilt: boolean };
  assert.equal(holder.rebuilt, true, "fell back to the recipe");
  assert.equal(read(holder.store, "count" as never), 3);
});

// F3: a streamed segment may mark (or read) more paths after the shell encoded the store: no narrowing while segments
// are pending, so the browser has every path the later segment's code uses.
const STREAM = `
import { Async } from "@rivetjs/runtime/server";
import { _rEffect, _rStorePaths } from "@rivetjs/runtime/server-resume";
import { createStore } from "@rivetjs/reactivity/store";
const later = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
export function Page() {
  const store = createStore({ count: 1, user: { name: "ada", bio: "LATEBIO" } });
  _rEffect("m.tsx#P$fx", [_rStorePaths(store, ["count"])]);
  return <main>
    <Async load={() => later(5, "a")} fallback={() => <i>a</i>}>{(v) => (_rEffect("m.tsx#P$fx", [_rStorePaths(store, ["user.bio"])]), <em>{v}</em>)}</Async>
  </main>;
}
`;
test("streamed: a segment marking new paths after the shell encoded the store reads them in the browser", async () => {
  const symbols = compileResume(STREAM, "dom").symbols;
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries([...symbols.map((s) => s.id), "m.tsx#P$fx"].map((id) => [id, "/c.js"])) };
  const mod = await importServer<{ Page(): never }>(compileResume(STREAM, "server").code);
  const chunks: string[] = [];
  await renderResumable(() => mod.Page(), { write: (chunk) => void chunks.push(chunk) }, { manifest, stream: {} });
  const html = chunks.join("");
  const shell = readable(JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)) as ResumeState;
  const patches = [...html.matchAll(/<script type="rivet\/state" data-patch="\d+">(.*?)<\/script>/gs)].map((m) => readable(JSON.parse(m[1]!)) as ResumeState);
  assert.equal(patches.length, 1);
  const t = [...shell.t, ...patches[0]!.t];
  const decoder = createDecoder(t, { signal: (value: unknown) => signal(value), custom } as never);
  const store = decoder.get(patches[0]!.fx[0]![1][0]!) as Parameters<typeof read>[0];
  assert.equal(decoder.get(shell.fx[0]![1][0]!), store, "one store entry");
  assert.equal(read(store, "user.bio" as never), "LATEBIO");
  assert.equal(read(store, "count" as never), 1);
});

// F4: dev decodes carry the kept paths; reading a path the page did not ship warns once, with the path.
test.runIf(DEV_RUN)("dev: reading an unshipped path of a resumed store warns once", async () => {
  const devCustom = (kind: string, args: unknown[]) => {
    if (kind !== "store") return undefined;
    const node = { ...(args[1] as object), v: args[0] };
    if (DEV && args[2]) DEV.resumeStore(node, args[2] as string[]);
    return node;
  };
  const { values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ count: 0, user: { name: "ada", bio: "LONGBIO" } }), ["count"]);
      read(store, "user.name");
      return [store];
    },
    {},
    { custom: devCustom, signal: (value: unknown) => signal(value) } as never,
  );
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => void warnings.push(String(args[0]));
  try {
    const store = values[0] as Parameters<typeof read>[0];
    read(store, "count" as never);
    read(store, "user.name" as never);
    read((at as (s: unknown, p: string) => Parameters<typeof read>[0])(store, "user"), "name" as never);
    assert.equal(warnings.length, 0, "shipped paths read silently");
    assert.equal(read(store, "user.bio" as never), undefined);
    read(store, "user.bio" as never);
    assert.equal(warnings.length, 1, "once per path");
    assert.match(warnings[0]!, /^Rivet resume: store path "user\.bio" was not shipped .*shipped: (count|user\.name), (count|user\.name)/);
    assert.match(warnings[0]!, /\n  fix: .*\n  docs: https:\/\/rivetjs\.severyn\.pro\/guides\/state\/stores#in-a-resumed-page$/);
    write(store, "extra" as never, 1 as never);
    read(store, "extra" as never);
    assert.equal(warnings.length, 1, "a written path is present");
    read(store);
    assert.equal(warnings.length, 2, "a whole read of a narrowed store warns");
  } finally {
    console.warn = warn;
  }
});
test("prod state carries no kept paths; dev does", async () => {
  const { state } = await roundTrip(() => [_rStorePaths(createStore({ count: 0 }), ["count"])], {}, { custom });
  const entry = state.t.find((e) => (e as { k?: string } | null)?.k === "store") as { a: number[] };
  assert.equal(entry.a.length, DEV_RUN ? 3 : 2);
});

// T13: a container pruned the same way for the root and for a node is one object (browser identity as unmarked).
test("pruned containers are shared between the root value and node values", async () => {
  const { values } = await roundTrip(
    () => {
      const store = _rStorePaths(createStore({ user: { name: "ada", email: "e", bio: "LONGBIO" }, list: [{ t: "a" }, { t: "b" }] }), ["user.email"]);
      read(store, "user.name");
      read(store, "list.1.t");
      read(store, "list");
      return [store];
    },
    {},
    { custom, signal: (value: unknown) => signal(value) } as never,
  );
  const store = values[0] as Parameters<typeof read>[0];
  const root = read(store) as { user: object; list: object[] };
  assert.equal(read(store, "user.name" as never), "ada");
  assert.equal(root.user, read(store, "user" as never));
  assert.deepEqual(Object.keys(root.user), ["name", "email"]);
  assert.equal(root.list, read(store, "list" as never), "a path read whole keeps the original");
});
test("a forbidden literal path ships nothing and never touches a prototype", async () => {
  const data = JSON.parse('{"count":1,"__proto__":{"polluted":"PROTO"},"blob":"BIGDATA"}') as object;
  const { html } = await roundTrip(() => [_rStorePaths(createStore(data), ["__proto__.polluted", "count"])], {}, { custom });
  assert.doesNotMatch(html, /PROTO|BIGDATA/);
  assert.equal(({} as { polluted?: string }).polluted, undefined);
});
