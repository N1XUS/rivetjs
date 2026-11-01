// FIX-CORE (2026-11-01): `dom-derived.ts` `opener` resumes one TreeWalker over the page's comments. The walker parks on the
// last opener it found; when app code (a Show swap, a removed row) detaches that comment, `nextNode()` from the detached
// node returns null (it never climbs back to the walker's root), so a later first lookup of another boundary found
// nothing and its first click was lost.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { title: string }) {
  const read = signal(false);
  return <><p>{props.title}</p><button type="button" onClick={() => read.update((v) => !v)}>{read() ? "Read" : "Not read"}</button></>;
}
export default function Home(props: { n: number }) {
  return <ul data-home>{Array.from({ length: props.n }, (_, i) => <li class="card"><Card title={"Book " + i} /></li>)}</ul>;
}`;
const RESUME = { module: "src/c.tsx", boundaries: ["Card", "Home"], independent: ["Card", "Home"], conditional: ["Home"] };
const compiled = hasDerivedModel() ? test : test.skip;
const manifest = { runtime: "/rt.js", symbols: { "src/c.tsx#Card": "/c.js", "src/c.tsx#default": "/c.js" } };

compiled("a boundary's first click adopts after the opener lookup's parked comment was removed", async () => {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  const { default: Home } = await importServer<{ default: (props: { n: number }) => ServerValue }>(server.code);
  const html = (await derivedToString(() => Home({ n: 4 }), { manifest })) as string;
  const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(dom.diagnostics, []);
  const files = {
    ...DERIVED_BUILD,
    "/": "<!doctype html><html><body>" + html + "</body></html>",
    "/rt.js": 'export { default } from "/dom-derived.ts";',
    "/c.js": rewrite(dom.code),
  };
  await withPage(files, async (p) => {
    await p.goto("http://rivet.test/");
    await p.click(".card:nth-child(2) button");
    await p.waitForFunction(() => document.querySelectorAll(".card button")[1]!.textContent === "Read");
    // App code removes the second card (its `<!--b<id>-->` opener inside): the walker's parked node.
    await p.evaluate(() => document.querySelectorAll(".card")[1]!.remove());
    await p.click(".card:nth-child(3) button");
    await p.waitForFunction(() => document.querySelectorAll(".card button")[2]!.textContent === "Read", undefined, { timeout: 3000 });
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll(".card button")].map((b) => b.textContent)), ["Not read", "Not read", "Read"]);
  });
});
