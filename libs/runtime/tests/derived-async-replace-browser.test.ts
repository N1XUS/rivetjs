// CX-ASYNC: an adopted Async range must stay current until replacement, then stable while reconciliation removes it.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile, hasDerivedModel } from "@rivetjs/compiler";
import type { ServerValue } from "@rivetjs/runtime/server";
import { derivedToString, renderDerived } from "@rivetjs/runtime/server-derived";
import { importServer } from "./resume/compile.ts";
import { DERIVED_BUILD, rewrite, withPage } from "./resume/harness.ts";

const compiled = hasDerivedModel() ? test : test.skip;
const manifest = { hash: "t", runtime: "/rt.js", symbols: { "src/page.tsx#App": "/page.js" } };
type Props = { replacement: "async" | "text" | "empty"; array?: boolean };
async function build() {
  const source = await readFile(new URL("./derived/async-replace.tsx", import.meta.url), "utf8");
  const resume = { module: "src/page.tsx", boundaries: ["App"], independent: ["App"] };
  const server = compile(source, { target: "server", filename: "page.tsx", resume } as never);
  const dom = compile(source, { target: "dom", filename: "page.tsx", resume } as never);
  assert.deepEqual(server.diagnostics, []);
  assert.deepEqual(dom.diagnostics, []);
  return { ...(await importServer<{ App: (props: Props) => ServerValue; seed: (data: PromiseLike<string>) => void }>(server.code)), dom: rewrite(dom.code) };
}

for (const array of [false, true])
  for (const streamed of [false, true])
    for (const replacement of ["async", "text", "empty"] as const)
      compiled(
        `adopted Async replacement: ${replacement}, ${streamed ? "segment after adoption" : "cold awaited content"}, ${array ? "array slot" : "sole slot"}`,
        async () => {
          const { App, seed, dom } = await build();
          let release!: (value: string) => void;
          const data = new Promise<string>((resolve) => (release = resolve));
          if (streamed) seed(data);
          const html = streamed ? "" : await derivedToString(() => App({ replacement, array }), { manifest, preload: { lean: true } });
          await withPage(
            {
              ...DERIVED_BUILD,
              "/": "<!doctype html><html><body>" + html + "</body></html>",
              "/rt.js": 'export { default } from "/dom-derived.ts";',
              "/page.js": dom,
            },
            async (page) => {
              const errors: string[] = [];
              page.on("pageerror", (error) => errors.push(String(error)));
              await page.goto("http://rivet.test/", { waitUntil: streamed ? "commit" : "load" });
              if (streamed) {
                await page.waitForSelector("#wait");
                await page.click("#wake");
                await page.waitForFunction(() => document.querySelector("#wake")?.textContent === "1");
                release("Ada Lovelace");
              }
              await page.waitForSelector("#name");
              assert.equal(await page.textContent("#name"), "Ada Lovelace");
              assert.equal(await page.evaluate(() => (window as unknown as { loads?: number }).loads ?? 0), 0, "server load is not repeated");
              await page.evaluate(() => {
                (window as unknown as { old: Node[] }).old = Array.from(document.querySelectorAll("#before, #after"));
              });
              await page.click("#next");
              const expected =
                "before" + (replacement === "async" ? "Grace Hopperdetail" : replacement === "text" ? "finished" : "") + (array ? "suffix" : "") + "after";
              await page.waitForFunction((text) => document.querySelector("#user")?.textContent === text, expected, { timeout: 2000 }).catch(() => {});
              assert.deepEqual(errors, [], "replacement must not read a shrinking live range");
              assert.equal(await page.textContent("#user"), expected, "all old nodes removed, new content and siblings kept");
              assert.equal(
                await page.evaluate(() =>
                  (window as unknown as { old: Node[] }).old.every((node, i) => node === document.querySelectorAll("#before, #after")[i]),
                ),
                true,
              );
              if (replacement === "async") {
                await page.click("#next");
                await page.waitForFunction(() => document.querySelector("#name")?.textContent === "Alan Turing");
                assert.equal(await page.locator("#detail").count(), 1);
              }
              assert.deepEqual(errors, []);
            },
            streamed
              ? {
                  streams: {
                    "/": (_request, response) => {
                      response.writeHead(200, { "content-type": "text/html" });
                      response.write("<!doctype html><html><body>");
                      void Promise.resolve(
                        renderDerived(
                          () => App({ replacement, array }),
                          { write: (chunk: string) => void response.write(chunk) },
                          { manifest, preload: { lean: true }, stream: {} },
                        ),
                      ).then(() => response.end("</body></html>"));
                    },
                  },
                }
              : {},
          );
        },
      );
