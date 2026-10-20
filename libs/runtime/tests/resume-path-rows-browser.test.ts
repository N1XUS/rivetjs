// Path-addressed list rows (fixture `resume/path-rows-fixture.tsx`): row-plan rows in row regions ship without `data-r`
// (state `w` + the rows add-on). Cold clicks resolve through the loader's `$rw`, bindings through the runtime's
// element map (`dom-resume` `build`), and rows added after resume behave as before.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { _setRowPaths, renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import { compileResume, importServer, symbolChunks, symbolUrls } from "./resume/compile.ts";
import { withPage, rewrite, symbolModules } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

// Fixture lists are short: address them by path whatever their size (the default needs 768 dropped ids per list).
_setRowPaths(true, 1);

type ServerValue = Parameters<typeof renderResumable>[0] extends () => infer V ? V : never;

const source = await readFile(new URL("./resume/path-rows-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/path-rows.tsx");
const server = await importServer<{ Rows(): ServerValue; Mixed(): ServerValue; Streamed(): ServerValue; Anchored(): ServerValue }>(
  compileResume(source, "server", "src/path-rows.tsx").code,
);
const byComponent = symbolChunks(dom.symbols);
const manifest: ResumeManifest = {
  hash: "path-rows",
  runtime: "/rt.js",
  symbols: symbolUrls(dom.symbols),
};
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
};
Object.assign(files, symbolModules(byComponent));

let shell = "";
const page =
  (render: () => ServerValue, stream?: object) =>
  (_request: IncomingMessage, response: ServerResponse): void => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.write("<!doctype html><html><head></head><body>");
    shell = "";
    void Promise.resolve(
      renderResumable(
        render,
        {
          write: (chunk: string) => {
            shell += chunk;
            response.write(chunk);
          },
        },
        { manifest, stream },
      ),
    ).then(() => response.end("</body></html>"));
  };
const read = `[document.getElementById("picked").textContent, [...document.querySelectorAll(".on")].map((e) => e.localName).join(",")].join(" ")`;

test("path-addressed rows: no row ids in the HTML; cold and live clicks, bindings and added rows resume", async () => {
  await withPage(
    files,
    async (tab) => {
      const errors: string[] = [];
      tab.on("pageerror", (error) => errors.push(error.message));
      tab.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await tab.goto("http://rivet.test/rows", { waitUntil: "load" });
      const body = shell.slice(0, shell.indexOf("<script"));
      // Rows: no `data-r` inside the lists (the add / output controls outside keep theirs); the state lists both lists.
      assert.doesNotMatch(body.slice(0, body.indexOf('id="add"')), /data-r=/, body);
      assert.match(shell, /"w":\[\[\d+,\d+,3,\["li:","button:1"\]\],\[\d+,\d+,3,\["td:0","button:1\.0"\]\]\]/, shell);
      assert.match(shell, /\.\$rw=/);
      // Cold: the loader resolves the row button's id through `$rw`.
      await tab.click("#list li:nth-child(2) .pick");
      await tab.waitForFunction((read) => String(eval(read)) === "2 li", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "2 li");
      // Live (runtime started): a table row's button, its sibling cell's binding.
      await tab.click("tbody tr:nth-child(3) .neg");
      await tab.waitForFunction((read) => String(eval(read)) === "-3 td", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "-3 td");
      // Rows added in the browser, then a server row again.
      await tab.click("#add");
      await tab.waitForFunction(() => document.querySelectorAll("#list li").length === 4, null, { timeout: 3000 }).catch(() => {});
      await tab.click("#list li:nth-child(4) .pick");
      await tab.waitForFunction((read) => String(eval(read)) === "4 li", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "4 li");
      await tab.click("#list li:nth-child(1) .pick");
      await tab.waitForFunction((read) => String(eval(read)) === "1 li", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "1 li");
      assert.deepEqual(errors, []);
    },
    // The runtime arrives late: the first click is cold (the loader reads the row button's id through `$rw`).
    { streams: { "/rows": page(() => server.Rows()) }, delays: { "/rt.js": 600 } },
  );
});

test("path-addressed rows: a row whose content slot held JSX keeps the list's `data-r` ids (no `w`)", async () => {
  const html = await resumableToString(() => server.Mixed(), { manifest });
  assert.equal((html.match(/<li class="[^"]*" data-r="\d+">/g) ?? []).length, 3, html);
  assert.doesNotMatch(html, /"w":|\.\$rw=/);
});

test("path-addressed rows in a streamed segment: the rows add-on ships before it; its rows resume", async () => {
  const scope = globalThis as unknown as { __load?: () => Promise<string> };
  let open!: (value: string) => void;
  scope.__load = () => new Promise<string>((resolve) => (open = resolve));
  try {
    await withPage(
      files,
      async (tab) => {
        const errors: string[] = [];
        tab.on("pageerror", (error) => errors.push(error.message));
        tab.on("console", (message) => message.type() === "error" && errors.push(message.text()));
        await tab.goto("http://rivet.test/streamed", { waitUntil: "commit" });
        await tab.waitForSelector("main i");
        assert.doesNotMatch(shell, /\.\$rw=/);
        open("x");
        await tab.waitForSelector("#late");
        assert.match(shell, /\.\$rw=[^]*<\/script><template data-a=/);
        assert.doesNotMatch(shell.slice(shell.indexOf("<template")), /<li[^>]*data-r=|<button[^>]*data-r=/);
        await tab.click("#late li:nth-child(3) .pick");
        await tab.waitForFunction(() => document.getElementById("picked")!.textContent === "3", null, { timeout: 3000 }).catch(() => {});
        assert.equal(await tab.evaluate(() => document.getElementById("picked")!.textContent + " " + document.querySelector(".on")?.textContent), "3 c");
        assert.deepEqual(errors, []);
      },
      { streams: { "/streamed": page(() => server.Streamed(), {}) } },
    );
  } finally {
    scope.__load = undefined;
  }
});

test("anchored path rows (outside row regions): the row root keeps its id, the rest resolve from it", async () => {
  const read = `document.getElementById("picked").textContent + " " + [...document.querySelectorAll("#static li")].map((e) => e.dataset.state).join(",")`;
  await withPage(
    files,
    async (tab) => {
      const errors: string[] = [];
      tab.on("pageerror", (error) => errors.push(error.message));
      tab.on("console", (message) => message.type() === "error" && errors.push(message.text()));
      await tab.goto("http://rivet.test/anchored", { waitUntil: "load" });
      const list = shell.slice(shell.indexOf('<ol id="static">'), shell.indexOf("</ol>"));
      assert.equal((list.match(/<li data-state="off" data-r="\d+">/g) ?? []).length, 3, list);
      assert.doesNotMatch(list, /<(span|button)[^>]*data-r=/);
      assert.match(shell, /"w":\[\[\d+,\d+,3,\["li:","button:1"\],1\]\]/);
      await tab.click("#static li:nth-child(2) .pick");
      await tab.waitForFunction((read) => String(eval(read)) === "2 off,on,off", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "2 off,on,off");
      await tab.click("#static li:nth-child(3) .pick");
      await tab.waitForFunction((read) => String(eval(read)) === "3 off,off,on", read, { timeout: 3000 }).catch(() => {});
      assert.equal(await tab.evaluate(read), "3 off,off,on");
      assert.deepEqual(errors, []);
    },
    { streams: { "/anchored": page(() => server.Anchored()) }, delays: { "/rt.js": 600 } },
  );
});
