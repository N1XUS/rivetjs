// `hidden="until-found"` on the client, mirroring the server (template.ts encodeAttributeValue): a
// non-empty string is written verbatim, true / other truthy → bare `hidden`, "" / false / null → omitted.
// Bound and spread attributes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as compiler from "@rivetjs/compiler";
import { withPage, rewrite } from "./resume/harness.ts";

const source = await readFile(new URL("./dom/hidden-fixture.tsx", import.meta.url), "utf8");
const compile = (): string => {
  const result = (compiler as unknown as { compile(src: string, o: object): { code: string; diagnostics: { message: string }[] } }).compile(source, {
    target: "dom",
    filename: "hidden.tsx",
  });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return rewrite(result.code);
};
const files = {
  "/fixture.mjs": compile(),
  "/": "<!doctype html><html><head></head><body><div id=host></div></body></html>",
};

test("hidden: a keyword string is written verbatim, true is bare, empty / false / null remove it", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    for (const module of ["/fixture.mjs"]) {
      const seen = await page.evaluate(async (module) => {
        const dom = (await import(/* @vite-ignore */ "/dom" + ".ts")) as { mount(factory: () => unknown, host: Element): void };
        const fixture = (await import(/* @vite-ignore */ module)) as { Panels(): unknown; state: { set(value: unknown): void } };
        const host = document.getElementById("host")!;
        host.innerHTML = "";
        fixture.state.set("until-found");
        dom.mount(() => fixture.Panels(), host);
        const out: string[] = [];
        for (const value of ["until-found", true, "", false, null, "until-found", 1]) {
          fixture.state.set(value);
          await new Promise((done) => setTimeout(done));
          for (const id of ["bound", "spread"]) {
            const el = document.getElementById(id)!;
            out.push(id + ":" + JSON.stringify(value) + "=" + JSON.stringify(el.getAttribute("hidden")) + "/" + el.hidden);
          }
        }
        return out;
      }, module);
      const expected = [
        ["until-found", "until-found", "until-found"],
        [true, "", true],
        ["", null, false],
        [false, null, false],
        [null, null, false],
        ["until-found", "until-found", "until-found"],
        [1, "", true],
      ].flatMap(([value, attribute, property]) =>
        ["bound", "spread"].map((id) => id + ":" + JSON.stringify(value) + "=" + JSON.stringify(attribute) + "/" + property),
      );
      assert.deepEqual(seen, expected, module);
    }
    assert.deepEqual(errors, []);
  });
});
