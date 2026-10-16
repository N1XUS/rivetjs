// Resumed pages: repeated sibling component instances record their text / attribute bindings once per run as a packed
// "+" state entry (`PackedBindings`, fixture `resume/packed-fixture.tsx`); dom-resume expands them before registering.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
type Entry = [number, string | null, string, number[], number[], number[], number, null?, { k: number; i?: number; d?: number; ids?: number[]; g?: 1 }?];

const source = await readFile(new URL("./resume/packed-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/packed.tsx");
const server = await importServer<{ Page(): ServerValue; Streamed(): ServerValue; Mixed(): ServerValue; Options(): ServerValue }>(
  compileResume(source, "server", "src/packed.tsx").code,
);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "packed",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const stateOf = (html: string): { b: Entry[] } => JSON.parse(/<script type="rivet\/state" data-region="0"[^>]*>(.*?)<\/script>/s.exec(html)![1]!);
const read = `[...document.querySelectorAll(".badge")].map((e) => e.title + "=" + e.textContent).join(" ") + " / " +
  [...document.querySelectorAll(".chip")].map((e) => e.firstChild.nextSibling.textContent).join(" ")`;

test("packed bindings: one state entry per repeated run (even strides, uneven ids); every instance updates after resume", async () => {
  const html = await resumableToString(() => server.Page(), { manifest });
  const packed = stateOf(html).b.filter((entry) => entry[1] === "+");
  // Badge title attributes, Badge texts (two per instance), Chip texts (a button's element id between rows 1 and 2).
  assert.equal(packed.length, 3);
  assert.equal(stateOf(html).b.length, 3);
  assert.deepEqual(
    packed.map((entry) => entry[8]!.ids ?? [entry[8]!.i, entry[8]!.d]),
    [
      [0, 3],
      [1, 3],
      [15, 16, 18, 19, 20],
    ],
  );
  await withPage({ ...files, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" }, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    assert.equal(await page.evaluate(read), "L0:1=1|2 L1:1=2|4 L2:1=3|6 L3:1=4|8 L4:1=5|10 / 1 2 3 4 5");
    await page.click("#go");
    await page.waitForFunction(() => (document.querySelector(".badge") as HTMLElement).title === "L0:2");
    assert.equal(await page.evaluate(read), "L0:2=2|4 L1:2=3|6 L2:2=4|8 L3:2=5|10 L4:2=6|12 / 2 3 4 5 6");
    await page.click(".x");
    await page.waitForFunction(() => (document.querySelector(".badge") as HTMLElement).title === "L0:102");
    assert.equal(await page.evaluate(read), "L0:102=102|204 L1:102=103|206 L2:102=104|208 L3:102=105|210 L4:102=106|212 / 102 103 104 105 106");
    assert.deepEqual(errors, []);
  });
});

test("packed bindings: rows whose captures reach other symbols stay single entries, in order", async () => {
  const b = stateOf(await resumableToString(() => server.Mixed(), { manifest })).b;
  // Row 0 and row 1 (the other call site's props recipe) single; rows 2–4 packed.
  assert.deepEqual(
    b.map((entry) => (entry[1] === "+" ? ["+", entry[8]!.k, entry[8]!.i] : entry[0])),
    [0, 1, ["+", 3, 2]],
  );
});

test("packed bindings: For rows in their own row regions pack with row-relative regions (g) and update after resume", async () => {
  const html = await resumableToString(() => server.Options(), { manifest });
  const b = stateOf(html).b;
  const packed = b.filter((entry) => entry[1] === "+");
  assert.equal(packed.length, 1, JSON.stringify(b));
  assert.equal(packed[0]![8]!.k, 5);
  assert.equal(packed[0]![8]!.g, 1);
  // Row 0's region: the row id right before its option (the first row's node − 1).
  assert.equal(packed[0]![6], packed[0]![8]!.i! - 1);
  const selected = `[...document.querySelectorAll("#opts option")].map((o) => (o.hasAttribute("selected") ? "+" : "-") + o.value).join(" ")`;
  await withPage({ ...files, "/": "<!doctype html><html><head></head><body>" + html + "</body></html>" }, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto("http://rivet.test/");
    assert.equal(await page.evaluate(selected), "-a +b -c -d -e");
    await page.click("#pick");
    await page.waitForFunction(() => document.querySelector("#opts option[value=d]")!.hasAttribute("selected"));
    assert.equal(await page.evaluate(selected), "-a -b -c +d -e");
    assert.deepEqual(errors, []);
  });
});

// Shell, then the Async segment once `open` is called (its patch carries a packed entry).
const scope = globalThis as unknown as { __load?: () => Promise<string> };
const streamed = (_request: IncomingMessage, response: ServerResponse): void => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.write("<!doctype html><html><head></head><body>");
  (renderResumable(() => server.Streamed(), { write: (chunk: string) => void response.write(chunk) }, { manifest, stream: {} }) as Promise<void>).then(() =>
    response.end("</body></html>"),
  );
};
const chips = `[...document.querySelectorAll("#chips .chip")].map((e) => e.textContent).join(" ")`;

for (const order of ["before", "after"] as const)
  test(`packed bindings in a streamed segment resume (segment ${order} the runtime starts)`, async () => {
    let open!: (value: string) => void;
    scope.__load = () => new Promise<string>((resolve) => (open = resolve));
    try {
      await withPage(
        files,
        async (page) => {
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
          await page.waitForSelector("#go");
          if (order === "before") {
            open("x");
            await page.waitForSelector("#chips");
          }
          await page.click("#go");
          if (order === "after") {
            // The runtime has started (the click ran through it) before the segment arrives.
            await page.waitForFunction(() => performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/c/Streamed.js")));
            await page.waitForTimeout(100);
            open("x");
            await page.waitForSelector("#chips");
          }
          await page.waitForFunction((read) => String(eval(read)) === "2 3 4 5 6", chips, { timeout: 3000 }).catch(() => {});
          assert.equal(await page.evaluate(chips), "2 3 4 5 6");
          await page.click("#go");
          await page.waitForFunction((read) => String(eval(read)) === "3 4 5 6 7", chips, { timeout: 3000 }).catch(() => {});
          assert.equal(await page.evaluate(chips), "3 4 5 6 7");
          assert.deepEqual(errors, []);
        },
        { streams: { "/stream": streamed } },
      );
    } finally {
      scope.__load = undefined;
    }
  });
