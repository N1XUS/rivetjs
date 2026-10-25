// ZERO C3 (2026-10-25): an independent boundary keeps no ancestor. A conditional page root (no source of its own) that
// only renders independent cards ships no record: the cards are top-level records (parent 0), and a card's event adopts
// only that card — no ancestor unit, no probe of the page, no anchors around 500 holes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { expandTail } from "@rivetjs/runtime/resume-format";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { title: string }) {
  const read = signal(false);
  return <li class="card"><p>{props.title}</p><button type="button" onClick={() => read.update((v) => !v)}>{read() ? "Read" : "Not read"}</button></li>;
}
export function Shared(props: { title: string }) {
  const read = signal(false);
  return <li class="dep"><button type="button" onClick={() => read.update((v) => !v)}>{read() ? props.title : "-"}</button></li>;
}
export default function Home(props: { n: number; dep?: boolean }) {
  return <ul data-home>{Array.from({ length: props.n }, (_, i) => (props.dep ? <Shared title={"B " + i} /> : <Card title={"Book " + i} />))}</ul>;
}`;
const RESUME = { module: "src/c.tsx", boundaries: ["Card", "Shared", "Home"], independent: ["Card", "Home"], conditional: ["Home"] };
const compiled = hasDerivedModel() ? test : test.skip;
const manifest = { runtime: "/rt.js", symbols: { "src/c.tsx#Card": "/c.js", "src/c.tsx#Shared": "/c.js", "src/c.tsx#default": "/c.js" } };

// Every node under body (elements, text, comments).
const COUNT = () => {
  let n = 0;
  const walk = document.createTreeWalker(document.body, 0xffffffff);
  while (walk.nextNode()) n++;
  return n;
};
async function page(n: number, dep = false): Promise<string> {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  const { default: Home } = await importServer<{ default: (props: { n: number; dep?: boolean }) => ServerValue }>(server.code);
  return (await derivedToString(() => Home({ n, dep }), { manifest })) as string;
}
const records = (html: string) =>
  expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!)).b.map(([id, parent, , name]) => [
    id,
    parent,
    name.slice(name.indexOf("#") + 1),
  ]);

compiled("a conditional root over independent children ships no record; the children are top-level", async () => {
  const html = await page(3);
  assert.deepEqual(records(html), [
    [2, 0, "Card"],
    [3, 0, "Card"],
    [4, 0, "Card"],
  ]);
  // A dependent child still keeps its parent (it adopts in the parent's run).
  assert.deepEqual(
    records(await page(2, true)).map(([, parent, name]) => [parent, name]),
    [
      [0, "default"],
      [1, "Shared"],
      [1, "Shared"],
    ],
  );
});

compiled("a card's first click adopts only that card under the dropped root", async () => {
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + (await page(50)) + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(dom.code),
  };
  await withPage(files, async (p) => {
    await p.goto("http://rivet.test/");
    const before = await p.evaluate(COUNT);
    await p.click(".card:nth-child(7) button");
    await p.waitForFunction(() => document.querySelectorAll(".card button")[6]!.textContent === "Read");
    await p.click(".card:nth-child(7) button");
    assert.equal(await p.evaluate(() => document.querySelectorAll(".card button")[6]!.textContent), "Not read");
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".card button")].filter((b) => b.textContent === "Read").length), 0);
    // O(1) nodes: the card's own adopt only (no ancestor adopt run claimed the 49 other cards as holes: +4 nodes each).
    const after = await p.evaluate(COUNT);
    assert.ok(after - before <= 4, `${before} → ${after}`);
    assert.equal(await p.evaluate(() => (globalThis as { __componentRuns?: number }).__componentRuns), undefined);
  });
});
