// Derived model, LIT keyed-value elision (ZERO S1, 2026-10-25): `_rSig(key, init, options, LIT)` / `_rSigStore(key, init,
// LIT)` — the compiler passes `LIT` when the initializer is a literal tree; a key still holding that very init at the
// flush (identity) ships nothing, the browser's `_sig` / `_sigStore` start from their own init for the absent key. A key
// written on the server (set / update / a store write), a non-literal init (no flag) and, in development, a literal
// object init mutated in place during render ship their value. `DOMREAD` (X9) keys elide the same way (identity).
// Fixture: `tests/derived/page.{server,dom}.tsx` with the flag added to its literal keys (as the compiler emits it).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { DEV } from "#dev";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

type Data = { title: string; rows: { id: number }[] };
const fixture = (name: string): Promise<string> => readFile(new URL("./derived/" + name, import.meta.url), "utf8");
const manifest = { hash: "t", runtime: "/rt.js", symbols: { App: "/page.js", Header: "/page.js", Counter: "/page.js" } };
const data = (n: number): Data => ({ title: "Records", rows: Array.from({ length: n }, (_, i) => ({ id: i + 1 })) });
// The literal keys of the fixture get the flag (`c-0` is `props.start`: not a literal, no flag).
const lit = (source: string): string => source.replace(/(_r?[sS]ig\("(?:h-0|a-0|a-1)", [^)]*?)\)/g, "$1, undefined, 1)");

type Rec = [number, number, number, string, unknown[], object?];
// The tail's records by name (v1 as is; v2 — ZERO S2 — names resolved, runs expanded): this suite does not depend on the
// wire format.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flushShape = (t: any): { b: Rec[]; w?: Record<string, number[]> } => {
  if (t.v !== 2) return t;
  const b: Rec[] = [];
  for (const e of t.b as unknown[][]) {
    if (e[3] !== -1) b.push([e[0], e[1], e[2], t.n[e[3] as number][0], (e[4] as unknown[]) ?? [], ...(e[5] ? [e[5]] : [])] as Rec);
    else
      for (let j = 0, tmpl = e[5] as number[][]; j < (e[4] as number) * tmpl.length; j++) {
        const [parent, flags, name] = tmpl[j % tmpl.length]!,
          id = (e[0] as number) + j;
        b.push([id, parent! < 0 ? id + parent! : parent!, flags!, t.n[name!][0], []]);
      }
  }
  return { ...t, b };
};
const tailOf = (html: string): { b: [number, number, number, string, unknown[], object?][]; w?: Record<string, number[]> } => {
  const match = html.match(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s);
  assert.ok(match, "boundaries tail present:\n" + html.slice(-400));
  return flushShape(JSON.parse(match[1]!));
};
async function render(source: string, n = 3): Promise<string> {
  const out = compile(source, { target: "server", filename: "page.server.tsx" });
  assert.deepEqual(out.diagnostics, []);
  const { App } = await importServer<{ App: (props: { data: Data }) => ServerValue }>(out.code);
  return (await derivedToString(() => App({ data: data(n) }), { manifest })) as string;
}

test("LIT keys still holding their literal init ship nothing; a non-literal key ships", async () => {
  const before = tailOf(await render(await fixture("page.server.tsx")));
  assert.deepEqual(
    before.b.map((r) => r[4]),
    [
      ["a-0", "light", "a-1", -1],
      ["h-0", false],
      ["c-0", 5],
    ],
  );
  const after = tailOf(await render(lit(await fixture("page.server.tsx"))));
  assert.deepEqual(
    after.b.map((r) => r.slice(0, 5)),
    [
      [1, 0, 1, "App", []],
      [2, 1, 0, "Header", []],
      [3, 1, 1, "Counter", ["c-0", 5]],
    ],
  );
  // Wake lists name keys, not values: unchanged.
  assert.deepEqual(after.w, before.w);
});

const one = (body: string): string => `
import { _rB, _rBOut, _rBEnd, _rSig, _rSigStore } from "@rivetjs/runtime/server-derived";
import { write } from "@rivetjs/reactivity/store";
export function App(props) {
  const B = _rB("App", 0, null, "click");
  try {
    ${body}
    return _rBOut(B, <button type="button" onClick={() => {}}>x</button>);
  } finally {
    _rBEnd(B);
  }
}`;
const values = async (body: string): Promise<unknown[]> => tailOf(await render(one(body))).b[0]![4];

test("a LIT key written on the server ships its value (set, update, same-literal set elides)", async () => {
  assert.deepEqual(await values('const s = _rSig("k-0", 0, undefined, 1); s.set(2);'), ["k-0", 2]);
  assert.deepEqual(await values('const s = _rSig("k-0", 0, undefined, 1); s.update((v) => v + 1);'), ["k-0", 1]);
  // Written back to an equal primitive: identical to the browser's init, nothing to ship.
  assert.deepEqual(await values('const s = _rSig("k-0", 0, undefined, 1); s.set(1); s.set(0);'), []);
  // A new array equal to the literal still ships (identity, not deep equality: no per-key JSON on the hot path).
  assert.deepEqual(await values('const s = _rSig("k-0", [], undefined, 1); s.set([]);'), ["k-0", []]);
  assert.deepEqual(await values('const s = _rSig("k-0", { a: 1 }, undefined, 1);'), []);
  // No flag: shipped as before.
  assert.deepEqual(await values('_rSig("k-0", 0);'), ["k-0", 0]);
  // Repeated site (`#2` key) keeps its own flag.
  assert.deepEqual(await values('_rSig("k-0", 0, undefined, 1); const t = _rSig("k-0", 0, undefined, 1); t.set(4);'), ["k-0#2", 4]);
});

test("DOMREAD keys (X9: the browser reads the init back from the markup): unwritten elides, a write ships", async () => {
  // A non-literal init (props, computed on the server) the compiler proved is rendered as is.
  assert.deepEqual(await values('const s = _rSig("k-0", "a" + Math.floor(2.5), undefined, 2);'), []);
  assert.deepEqual(await values('const s = _rSig("k-0", "a2", undefined, 2); s.set("b");'), ["k-0", "b"]);
  // An object init with DOMREAD alone takes no development JSON snapshot (only `LIT` objects do): identity decides.
  assert.deepEqual(await values('const s = _rSig("k-0", { a: 1 }, undefined, 2); s().a = 2;'), []);
  // Both flags: elided while unwritten.
  assert.deepEqual(await values('_rSig("k-0", 3, undefined, 3);'), []);
});

test("LIT stores: unwritten elides, any write (copy) ships", async () => {
  assert.deepEqual(await values('_rSigStore("k-0", { n: 1, list: [] }, 1);'), []);
  assert.deepEqual(await values('const st = _rSigStore("k-0", { n: 1 }, 1); write(st, "n", 2);'), ["k-0", { n: 2 }]);
  assert.deepEqual(await values('_rSigStore("k-0", { n: 1 });'), ["k-0", { n: 1 }]);
});

test("development: a literal object init mutated in place during render ships its value, with a warning", async () => {
  const warn = console.warn,
    seen: string[] = [];
  console.warn = (message: string) => void seen.push(String(message));
  try {
    const got = await values('const s = _rSig("k-0", [], undefined, 1); s().push(1);');
    // Production keeps the identity contract (render does not mutate a literal init): nothing shipped, no check.
    assert.deepEqual(got, DEV ? ["k-0", [1]] : []);
    assert.equal(
      seen.some((m) => m.includes("k-0") && m.includes("mutated in place")),
      !!DEV,
    );
  } finally {
    console.warn = warn;
  }
});

test("browser: absent LIT keys adopt from the browser's own init (toggle, theme wake, row selection)", async () => {
  const dom = compile(lit(await fixture("page.dom.tsx")), { target: "dom", filename: "page.dom.tsx" });
  assert.deepEqual(dom.diagnostics, []);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + (await render(lit(await fixture("page.server.tsx")), 4)) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/page.js": rewrite(dom.code),
  };
  await withPage(files, async (page) => {
    await page.goto("http://rivet.test/");
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#open") !== null);
    await page.click("#toggle");
    assert.equal(await page.textContent("#closed"), "closed");
    // App's `a-0` (absent from the record) wakes Counter on its first write.
    await page.click("#dark");
    await page.waitForFunction(() => document.querySelector("#theme")!.textContent === "dark");
    await page.click("ul li:nth-child(3) .pick");
    await page.waitForFunction(() => document.querySelector("ul li:nth-child(3)")!.getAttribute("data-sel") === "y");
    assert.equal(await page.getAttribute("ul li:nth-child(1)", "data-sel"), "n");
    await page.click("#inc");
    assert.equal(await page.textContent("#count"), "6");
  });
});
