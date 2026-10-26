// ZERO CALLSITE (2026-10-26): per-call-site independence. The build's context proof (`facts-callsite.ts`) marks a
// dependent component independent at the call sites with no provider of a context it reads above them (`resume.site` +
// `resume.sites`: the caller passes the props object through `_rS`, the callee's `_rB` takes it: `INDEPENDENT | CTXFREE`
// there, dependent at every other site), and an independent one with every site proven `CTXFREE` (`resume.free`). A
// `CTXFREE` record below another one adopts standalone on its first event: the browser runs no ancestor unit for it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { createContext, signal, useContext } from "@rivetjs/reactivity";
export const Theme = createContext("light");
export function Part(props: { label: string }) {
  const theme = useContext(Theme);
  const n = signal(0);
  return <button class={"part " + theme} onClick={() => n.set(n() + 1)}>{props.label + n()}</button>;
}
export function Counter(props: { start: number }) {
  const n = signal(props.start);
  return <button class="counter" onClick={() => n.set(n() + 1)}>{n()}</button>;
}
export default function Home() {
  (globalThis as { __homeRuns?: number }).__homeRuns = ((globalThis as { __homeRuns?: number }).__homeRuns ?? 0) + 1;
  const text = signal("");
  return (
    <main>
      <input onInput={(e) => text.set((e.target as HTMLInputElement).value)} />
      <h1>{text()}</h1>
      <Part label="a" />
      <Part label="b" />
      <Counter start={5} />
    </main>
  );
}`;
const compiled = hasDerivedModel() ? test : test.skip;
const manifest = { runtime: "/rt.js", symbols: { "src/c.tsx#Part": "/c.js", "src/c.tsx#Counter": "/c.js", "src/c.tsx#default": "/c.js" } };
const BASE = { module: "src/c.tsx", boundaries: ["Part", "Counter", "Home"], independent: ["Counter", "Home"] };
// Home's calls: Part (0), Part (1), Counter (2); the build proved the first Part site and every Counter site.
const PROVEN = { ...BASE, site: ["Part"], sites: ["Home:0"], free: ["Counter"] };

async function page(resume: object): Promise<string> {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  const { default: Home } = await importServer<{ default: () => ServerValue }>(server.code);
  return (await derivedToString(() => Home(), { manifest })) as string;
}
const records = (html: string) =>
  expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)).b.map(([, parent, flags, name, , props]) => [
    parent,
    name.slice(name.indexOf("#") + 1),
    flags & (1 | 4096),
    props ?? null,
  ]);

compiled("a proven call site makes that instance independent and CTXFREE; the other site stays dependent", async () => {
  assert.deepEqual(records(await page(BASE)), [
    [0, "default", 0, null],
    [1, "Part", 0, null],
    [1, "Part", 0, null],
    [1, "Counter", 1, { start: 5 }],
  ]);
  assert.deepEqual(records(await page(PROVEN)), [
    [0, "default", 0, null],
    [1, "Part", 4097, { label: "a" }],
    [1, "Part", 0, null],
    [1, "Counter", 4097, { start: 5 }],
  ]);
});

compiled("a CTXFREE record adopts standalone on its first click (no ancestor unit runs); an unproven one adopts with its parent", async () => {
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: PROVEN } as never);
  assert.deepEqual(dom.diagnostics, []);
  const files = (html: string) => ({
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(dom.code),
  });
  const html = await page(PROVEN);
  await withPage(files(html), async (p) => {
    await p.goto("http://rivet.test/");
    await p.evaluate(() => void ((globalThis as { __homeRuns?: number }).__homeRuns = 0));
    await p.click(".part.light");
    await p.waitForFunction(() => document.querySelector(".part")!.textContent === "a1");
    await p.click(".counter");
    await p.waitForFunction(() => document.querySelector(".counter")!.textContent === "6");
    assert.equal(await p.evaluate(() => (globalThis as { __homeRuns?: number }).__homeRuns), 0);
    // The unproven Part adopts with its parent (Home's unit), the adopted parts keep their state.
    await p.click(".part:nth-of-type(2)");
    await p.waitForFunction(() => document.querySelectorAll(".part")[1]!.textContent === "b1");
    assert.ok((await p.evaluate(() => (globalThis as { __homeRuns?: number }).__homeRuns))! > 0);
    assert.equal(await p.evaluate(() => document.querySelector(".part")!.textContent), "a1");
    assert.equal(await p.evaluate(() => document.querySelector(".counter")!.textContent), "6");
  });
});

compiled("without the proof an independent record's first click still adopts its ancestors (intake 3)", async () => {
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: BASE } as never);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + (await page(BASE)) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(dom.code),
  };
  await withPage(files, async (p) => {
    await p.goto("http://rivet.test/");
    await p.evaluate(() => void ((globalThis as { __homeRuns?: number }).__homeRuns = 0));
    await p.click(".counter");
    await p.waitForFunction(() => document.querySelector(".counter")!.textContent === "6");
    assert.ok((await p.evaluate(() => (globalThis as { __homeRuns?: number }).__homeRuns))! > 0);
  });
});
