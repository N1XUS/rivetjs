// DOM fixes: foreign-namespace children built before their parent (svg / mathml), and eager JSX passed
// to a component surviving its branch unmounting.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as compiler from "@rivetjs/compiler";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Page } from "playwright";

const source = await readFile(new URL("./dom/fixes-fixture.tsx", import.meta.url), "utf8");
const compile = (): string => {
  const result = (compiler as unknown as { compile(src: string, o: object): { code: string; diagnostics: { message: string }[] } }).compile(source, {
    target: "dom",
    filename: "fixes.tsx",
  });
  if (result.diagnostics.length) throw new Error(result.diagnostics.map((d) => d.message).join("\n"));
  return rewrite(result.code);
};
const files = {
  "/fixture.mjs": compile(),
  "/": "<!doctype html><html><head></head><body><div id=host></div></body></html>",
};
const icon = [
  ["path", { d: "M1 1" }],
  ["circle", { r: "2" }],
];

const namespaces = (page: Page, module: string, component: string) =>
  page.evaluate(
    async ([module, component, icon]) => {
      const dom = (await import(/* @vite-ignore */ "/dom" + ".ts")) as { mount(factory: () => unknown, host: Element): void };
      const fixture = (await import(/* @vite-ignore */ module as string)) as Record<string, (props: unknown) => unknown>;
      const host = document.getElementById("host")!;
      host.innerHTML = "";
      dom.mount(() => fixture[component as string]({ icon }), host);
      return [...host.querySelectorAll("*")].map((el) => el.localName + "@" + el.namespaceURI!.split("/").pop()).join(",");
    },
    [module, component, icon] as const,
  );

test("svg / mathml children built from expressions take their parent's namespace", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    assert.equal(await namespaces(page, "/fixture.mjs", "Icon"), "svg@svg,path@svg,circle@svg");
    assert.equal(await namespaces(page, "/fixture.mjs", "DynamicIcon"), "svg@svg,path@svg,circle@svg");
    assert.equal(await namespaces(page, "/fixture.mjs", "Math"), "math@MathML,mi@MathML,mi@MathML");
    assert.deepEqual(errors, []);
  });
});

test("eager JSX passed to a component survives the branch unmounting and remounting", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const result = await page.evaluate(async () => {
      const dom = (await import(/* @vite-ignore */ "/dom" + ".ts")) as { mount(factory: () => unknown, host: Element): void };
      const fixture = (await import(/* @vite-ignore */ "/fixture" + ".mjs")) as { Reopen(): unknown; open: { set(value: boolean): void } };
      const host = document.getElementById("host")!;
      dom.mount(() => fixture.Reopen(), host);
      const text = () => host.querySelector(".card")?.textContent?.replace(/\s+/g, " ").trim() ?? "(closed)";
      const out = [text()];
      fixture.open.set(true);
      out.push(text());
      fixture.open.set(false);
      out.push(text());
      fixture.open.set(true);
      out.push(text());
      return out;
    });
    assert.deepEqual(result, ["(closed)", "Carddescription bold", "(closed)", "Carddescription bold"]);
    assert.deepEqual(errors, []);
  });
});
