// Resumed pages with marker ids left out (`<!--r-->`, fixture `resume/marks-fixture.tsx`): the browser reads them
// from document order, keeps them across the rescan a streamed segment triggers (after a region re-created
// its markers away), and streamed content and what follows a boundary start with written ids.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderResumable } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = Parameters<typeof renderResumable>[0] extends () => infer V ? V : never;

const source = await readFile(new URL("./resume/marks-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/marks.tsx");
const server = await importServer<{ Page(): ServerValue; Rows(): ServerValue }>(compileResume(source, "server", "src/marks.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const manifest: ResumeManifest = {
  hash: "marks",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

const scope = globalThis as unknown as { __load?: () => Promise<string> };
let shell = "";
const streamed =
  (page: () => ServerValue) =>
  (_request: IncomingMessage, response: ServerResponse): void => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.write("<!doctype html><html><head></head><body>");
    shell = "";
    (
      renderResumable(
        page,
        {
          write: (chunk: string) => {
            shell += chunk;
            response.write(chunk);
          },
        },
        { manifest, stream: {} },
      ) as Promise<void>
    ).then(() => response.end("</body></html>"));
  };
const read = `["head", "region", "tail", "late", "after"].map((id) => document.getElementById(id)?.textContent ?? "-").join(" ")`;

test("left-out marker ids resume, across a re-created region and a streamed segment's rescan", async () => {
  let open!: (value: string) => void;
  scope.__load = () => new Promise<string>((resolve) => (open = resolve));
  try {
    await withPage(
      files,
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
        await page.goto("http://rivet.test/stream", { waitUntil: "commit" });
        await page.waitForSelector("#after");
        // Each run's third text marker continues the stride of the two before it (ids 2, 3, 4 / 8, 9, 10 / 12, 13, 14),
        // as does the Async site's region (11) after the tail: their ids are left out. The boundary keeps its id.
        assert.equal((shell.match(/<!--r-->/g) ?? []).length, 3, shell);
        assert.equal((shell.match(/<!--r\[-->/g) ?? []).length, 1, shell);
        assert.match(shell, /<!--r\[--><!--r15\[--><i>wait/);
        assert.equal(await page.evaluate(read), "123 45 678 - 121314");
        await page.click("#go");
        await page.waitForFunction((read) => String(eval(read)).startsWith("234"), read, { timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(read), "234 56 789 - 131415");
        // The region re-creates: its server markers are gone before the segment's rescan.
        await page.click("#flip");
        await page.waitForFunction(() => document.getElementById("region")!.textContent === "off");
        open("x");
        await page.waitForSelector("#late");
        await page.click("#go");
        await page.waitForFunction((read) => String(eval(read)).startsWith("345"), read, { timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(read), "345 off 8910 111213 141516");
        await page.click("#flip");
        await page.click("#go");
        await page.waitForFunction((read) => String(eval(read)).startsWith("456"), read, { timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(read), "456 78 91011 121314 151617");
        assert.deepEqual(errors, []);
      },
      { streams: { "/stream": streamed(() => server.Page()) } },
    );
  } finally {
    scope.__load = undefined;
  }
});

test("left-out marker ids of rows after a removed row keep their first-scan ids across a segment's rescan", async () => {
  let open!: (value: string) => void;
  scope.__load = () => new Promise<string>((resolve) => (open = resolve));
  const rows = `[...document.querySelectorAll("li")].map((e) => e.textContent).join(" ")`;
  try {
    await withPage(
      files,
      async (page) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
        await page.goto("http://rivet.test/rows", { waitUntil: "commit" });
        await page.waitForSelector("section i");
        // Rows 1–3: region and text ids continue the stride of row 0's (2, 3): left out.
        assert.match(shell, /<!--r2\[--><li>0:<!--r3-->0<!--\/--><\/li><!--\]--><!--r\[--><li>1:<!--r-->0/);
        await page.click("#drop");
        await page.waitForFunction((rows) => String(eval(rows)) === "0:0 2:0 3:0", rows, { timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(rows), "0:0 2:0 3:0");
        open("x");
        await page.waitForSelector("#late");
        // The rescan no longer sees row 1's markers: rows 2 and 3 keep the ids the first scan read.
        await page.click("#bump");
        await page.waitForFunction((rows) => String(eval(rows)) === "0:1 2:1 3:1", rows, { timeout: 3000 }).catch(() => {});
        assert.equal(await page.evaluate(rows), "0:1 2:1 3:1");
        assert.deepEqual(errors, []);
      },
      { streams: { "/rows": streamed(() => server.Rows()) } },
    );
  } finally {
    scope.__load = undefined;
  }
});
