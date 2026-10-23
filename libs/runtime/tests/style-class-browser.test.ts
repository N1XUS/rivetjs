// G10: class: / style: directives, class objects / arrays and style objects on server and DOM
// (CSSOM writes, so a strict style-src CSP does not block DOM styles).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compile } from "@rivetjs/compiler";
import { renderToString } from "@rivetjs/runtime/server";
import { importServer } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type Component = (props?: unknown) => unknown;
const source = await readFile(new URL("./resume/style-class-fixture.tsx", import.meta.url), "utf8");
const names = ["Toggles", "Objects", "Spread"] as const;
type Name = (typeof names)[number] | "Unsafe";

const plainServer = compile(source, { target: "server", filename: "fixture.tsx" });
assert.deepEqual(plainServer.diagnostics, []);
const server = await importServer<Record<Name, Component>>(plainServer.code);
const ssr = async (name: Name, props?: unknown) => (await renderToString(server[name](props) as never)).replace(/<!--[^>]*-->/g, "");

const TOGGLES = '<p id="t" class="base on" style="color:red;--rv-x:1;margin-top:1px;background-image:none">t</p>';
const OBJECTS = '<p id="o" class="big">o</p><span id="a" class="a c">a</span><i id="m" class="x y">m</i>';
// MATRIX-1: the style group joins the spread object at its own (last) position.
const SPREAD = '<div id="sp" class="s1" title="one" style="color:green">sp</div>';

test("server: toggles and objects merge into one escaped class attribute; style objects into one style attribute", async () => {
  assert.equal(await ssr("Toggles"), `<main>${TOGGLES}<button id="flip">flip</button><button id="unsafe">unsafe</button></main>`);
  assert.equal(await ssr("Objects"), `<main>${OBJECTS}<button id="toggle">toggle</button></main>`);
  assert.equal(await ssr("Spread"), `<main>${SPREAD}<button id="go">go</button></main>`);
});

test("server: an unsafe dynamic style value is dropped; values are attribute-escaped", async () => {
  assert.equal(await ssr("Unsafe", { value: "url(https://evil.test/x.png)" }), '<p id="u" style="color:red">u</p>');
  assert.equal(await ssr("Unsafe", { value: "expression(alert(1))" }), '<p id="u" style="color:red">u</p>');
  assert.equal(await ssr("Unsafe", { value: '"a&b"' }), '<p id="u" style="background:&quot;a&amp;b&quot;;color:red">u</p>');
});

const state = (page: import("playwright").Page) =>
  page.evaluate(() => {
    const p = document.querySelector("#t") as HTMLElement | null,
      sp = document.querySelector("#sp") as HTMLElement | null,
      name = (id: string) => document.querySelector(id)?.className;
    return {
      t: p && [p.className, p.style.color, p.style.getPropertyValue("--rv-x"), p.style.marginTop, p.style.backgroundImage],
      o: [name("#o"), name("#a"), name("#m")],
      sp: sp && [sp.className, sp.title, sp.style.color],
    };
  });

const checks: Record<(typeof names)[number], (page: import("playwright").Page) => Promise<void>> = {
  async Toggles(page) {
    assert.deepEqual((await state(page)).t, ["base on", "red", "1", "1px", "none"]);
    await page.click("#flip");
    await page.waitForFunction(() => document.querySelector("#t")!.className === "base off");
    assert.deepEqual((await state(page)).t, ["base off", "blue", "2", "1px", "none"]);
    await page.click("#unsafe");
    await page.waitForFunction(() => (document.querySelector("#t") as HTMLElement).style.backgroundImage === "");
  },
  async Objects(page) {
    assert.deepEqual((await state(page)).o, ["big", "a c", "x y"]);
    await page.click("#toggle");
    await page.waitForFunction(() => document.querySelector("#a")!.className === "a b c d");
    assert.deepEqual((await state(page)).o, ["big active", "a b c d", "x z"]);
  },
  async Spread(page) {
    assert.deepEqual((await state(page)).sp, ["s1", "one", "green"]);
    await page.click("#go");
    await page.waitForFunction(() => (document.querySelector("#sp") as HTMLElement).style.color === "purple");
    assert.deepEqual((await state(page)).sp, ["s3 s2 on", "two", "purple"]);
  },
};

const dom = compile(source, { target: "dom", filename: "fixture.tsx" });
assert.deepEqual(dom.diagnostics, []);
// A strict style-src: markup style attributes would be blocked; CSSOM writes are not.
const CSP = `<meta http-equiv="Content-Security-Policy" content="style-src 'none'">`;
const domFiles: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/": `<!doctype html><head>${CSP}</head><body><div id="host"></div><script type="module">
import { mount } from "/dom.ts";
import * as m from "/fixture.mjs";
const host = document.getElementById("host");
for (const name of ${JSON.stringify(names)}) mount(() => m[name](), host.appendChild(document.createElement("div")));
window.ready = true;
</script></body>`,
};

test("DOM: classList toggles, CSSOM properties (under a strict style-src CSP), merged class bindings and spreads", async () => {
  await withPage(domFiles, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    await page.waitForFunction(() => (window as { ready?: boolean }).ready);
    for (const name of names) await checks[name](page);
    // The policy is in force: a style attribute from markup is ignored.
    assert.equal(
      await page.evaluate(
        () => (
          document.body.insertAdjacentHTML("beforeend", '<b id="csp" style="color:red">x</b>'),
          (document.querySelector("#csp") as HTMLElement).style.color
        ),
      ),
      "",
    );
    assert.deepEqual(errors, []);
  });
});
