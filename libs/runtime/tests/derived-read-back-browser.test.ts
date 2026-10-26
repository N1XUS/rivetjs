// ZERO REGRESS props read back (compiler `compile/derived_read.rs`, server `server-derived.ts` `shipped`, client
// `dom-derived.ts` `propsOf`): an independent card whose props only ever become its elements' text ships a record without
// them (names table `n[i][3]` = `"key=path …"`), and the browser reads them back from the markup before the card's
// standalone adopt — the adopt matches the server nodes (no dev mismatch), and the text stays what the server rendered.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, DEV_BUILD, rewrite, withPage } from "./resume/harness.ts";

const SOURCE = `import { signal } from "@rivetjs/reactivity";
export function Card(props: { title: string; author: string; pages: number }) {
  const read = signal(false);
  return (
    <li class="card">
      <div><h3>{props.title}</h3><p>{props.author}</p></div>
      <span>{props.pages}</span>
      <button type="button" onClick={() => read.update((v) => !v)}>{read() ? "Read" : "Not read"}</button>
    </li>
  );
}
export default function Home(props: { books: { title: string; author: string; pages: number }[] }) {
  return <ul data-home>{props.books.map((b) => <Card title={b.title} author={b.author} pages={b.pages} />)}</ul>;
}`;
const RESUME = { module: "src/c.tsx", boundaries: ["Card", "Home"], independent: ["Card", "Home"], conditional: ["Home"] };
const compiled = hasDerivedModel() ? test : test.skip;
const manifest = { runtime: "/rt.js", symbols: { "src/c.tsx#Card": "/c.js", "src/c.tsx#default": "/c.js" } };
const BOOKS = [
  { title: "Dune & <Sons>", author: "Frank Herbert", pages: 412 },
  // An empty string (no text node): shipped.
  { title: "Second", author: "", pages: 0 },
  { title: "  spaced  ", author: "A. N. Other", pages: 7 },
];

async function page(books = BOOKS): Promise<string> {
  const server = compile(SOURCE, { target: "server", filename: "c.tsx", resume: RESUME } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.match(server.code, /"click", undefined, "title=ff author=ffn pages=fn"\)/);
  const { default: Home } = await importServer<{ default: (props: { books: typeof BOOKS }) => ServerValue }>(server.code);
  return (await derivedToString(() => Home({ books }), { manifest })) as string;
}

compiled("the record leaves out the read-back props; the names table says how to read them", async () => {
  // A CR (the HTML parser rewrites it) ships too.
  const html = await page([BOOKS[0]!, { title: "Line\r\nbreak", author: "", pages: 0 }, BOOKS[2]!]);
  const tail = JSON.parse(/<script type="rivet\/boundaries"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
  assert.deepEqual(tail.n[0].slice(2), ["click", "title=ff author=ffn pages=fn"]);
  // Card 1: nothing left (a run member); card 2: the CR title and the empty author ship.
  const props = tail.b.map((entry: unknown[]) => (entry[3] === -1 ? "run" : (entry[5] ?? null)));
  assert.deepEqual(props, [null, { title: "Line\r\nbreak", author: "" }, null]);
});

for (const dev of [false, true])
  compiled(`first clicks adopt each card from its markup${dev ? " (dev: no mismatch)" : ""}`, async () => {
    const dom = compile(SOURCE, { target: "dom", filename: "c.tsx", resume: RESUME } as never);
    assert.deepEqual(dom.diagnostics, []);
    const files = {
      ...DERIVED_BUILD,
      ...(dev ? DEV_BUILD : {}),
      "/": "<!doctype html><html><body>" + (await page()) + "</body></html>",
      "/rt.js": 'export { default } from "/dom-derived.ts";',
      "/c.js": rewrite(dom.code),
    };
    await withPage(files, async (p) => {
      const warnings: string[] = [];
      p.on("console", (m) => void ((m.type() === "warning" || m.type() === "error") && warnings.push(m.text())));
      await p.goto("http://rivet.test/");
      const text = () => p.evaluate(() => [...document.querySelectorAll(".card")].map((li) => li.textContent));
      const before = await text();
      for (let i = 1; i <= BOOKS.length; i++) {
        await p.click(`.card:nth-child(${i}) button`);
        await p.waitForFunction((i) => document.querySelectorAll(".card button")[i - 1]!.textContent === "Read", i);
      }
      assert.deepEqual(
        await text(),
        before.map((t) => t!.replace("Not read", "Read")),
      );
      assert.deepEqual(warnings, []);
    });
  });
