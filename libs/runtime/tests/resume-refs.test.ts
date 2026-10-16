// G24: SSR → resume → interact with ref() objects (by element id, forwarded, per For row, late attach).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = await readFile(new URL("./resume/refs-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/refs.tsx");
const server = await importServer<{ Page(): ServerValue }>(compileResume(source, "server", "src/refs.tsx").code);
const manifest: ResumeManifest = {
  hash: "refs",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const html = await resumableToString(() => server.Page(), { manifest });
const state = JSON.parse(html.match(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/)![1]!);

test("server: ref() attributes render no markup; captured refs serialize as element ids (attached or not)", () => {
  assert.match(html, /<canvas id="canvas" data-r="\d+"><\/canvas>/);
  assert.match(html, /<input id="name" data-r="\d+">/);
  assert.match(html, /<input id="other">/, "an absent forwarded ref records nothing");
  for (const name of ["a", "b", "c"]) assert.match(html, new RegExp(`<li id="row-${name}" data-r="\\d+">`));
  assert.doesNotMatch(html, /id="panel"/);
  // A ref() object is a signal holding its element entry; canvas (handler + effect share one entry),
  // name, three rows, and the unattached panel (a signal holding undefined).
  const t = state.t as ({ s?: number; r?: number; u?: 0 } | null)[];
  const signals = t.filter((e) => e?.s !== undefined);
  assert.equal(signals.filter((e) => t[e!.s!]?.r !== undefined).length, 6, JSON.stringify(t));
  // The element of a ref inside a region carries the region id (`z`): its removal resets the ref.
  assert.ok(
    t.some((e) => e?.r !== undefined && (e as { z?: number }).z !== undefined),
    JSON.stringify(t),
  );
  assert.ok(
    signals.some((e) => t[e!.s!]?.u === 0),
    JSON.stringify(t),
  );
});

test("server (production and dev): a callback passed as a ref value fails the render (it would never run on the resumed page)", async () => {
  const bad = await importServer<{ Page(): ServerValue }>(
    compileResume(
      `function Field(props) { return <input ref={props.inputRef} onInput={() => 1} />; }\nexport function Page() { return <Field inputRef={(el) => el.focus()} />; }`,
      "server",
      "src/bad.tsx",
    ).code,
  );
  await assert.rejects(
    Promise.resolve().then(() => resumableToString(() => bad.Page(), { manifest })),
    /Cannot resume a ref callback passed as a value; use ref\(\)/,
  );
  // A ref() object or no value passes.
  const good = await importServer<{ Page(): ServerValue }>(
    compileResume(
      `import { ref } from "@rivetjs/runtime/dom";\nfunction Field(props) { return <input ref={props.inputRef} />; }\nexport function Page() { return <><Field inputRef={ref()} /><Field /></>; }`,
      "server",
      "src/good.tsx",
    ).code,
  );
  assert.match(await resumableToString(() => good.Page(), { manifest }), /<input data-r="\d+"><input>/);
});

const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  "/": "<!doctype html><html><head></head><body>" + html + "</body></html>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));

test("resume: handlers and effects get the element; forwarded and per-row refs; a late Show branch attaches", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/");
    const wait = (fn: string) =>
      page
        .waitForFunction(fn, undefined, { timeout: 5000 })
        .catch(async () => Promise.reject(new Error(fn + "; errors: " + errors.join(" | ") + "; " + (await page.content()))));
    await wait(`document.querySelector("#canvas").dataset.drawn === "yes"`);
    await page.click("#paint");
    await wait(`document.querySelector("#canvas").dataset.clicks === "1"`);
    await page.click("#fill");
    await wait(`document.querySelector("#name").value === "filled"`);
    assert.equal(await page.evaluate(() => (document.querySelector("#other") as HTMLInputElement).value), "");
    await page.click("#row-b");
    await wait(`document.querySelector("#row-b").dataset.hit === "b"`);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("li")].map((li) => li.dataset.hit ?? "")), ["", "b", ""]);
    await page.click("#row-c");
    await wait(`document.querySelector("#row-c").dataset.hit === "c"`);
    await wait(`document.querySelector("#seen").textContent === "none"`);
    await page.click("#open");
    await wait(`document.querySelector("#seen").textContent === "panel"`);
    // Unmount (Show off) resets the browser-attached ref; the effect sees undefined.
    await page.click("#open");
    await wait(`document.querySelector("#seen").textContent === "none" && !document.querySelector("#panel")`);
    // A server-rendered element removed by its Show resets the resumed ref too.
    await wait(`document.querySelector("#sseen").textContent === "spanel"`);
    await page.click("#close");
    await wait(`!document.querySelector("#spanel")`);
    await wait(`document.querySelector("#sseen").textContent === "none"`);
    assert.deepEqual(errors, []);
  });
});

test("pay-per-use: the resume runtime entries carry no ref() object code", async () => {
  const { rolldown } = await import("rolldown");
  for (const entry of ["../dom-resume.ts", "../server-resume.ts"]) {
    const bundle = await rolldown({
      input: new URL(entry, import.meta.url).pathname,
      platform: "node",
      logLevel: "silent",
      external: [/^node:/],
      resolve: { conditionNames: ["import", "production", "default"] },
      transform: { define: { "process.env.NODE_ENV": '"production"' } },
    });
    const { output } = await bundle.generate({ format: "esm", minify: true });
    const code = output[0].code;
    // Neither the ref() factories nor the dev-only refusal reach the entries.
    assert.doesNotMatch(code, /ref callback passed as a value/, entry);
    assert.doesNotMatch(code, /"ref"/, entry);
    assert.ok(!code.includes("encode(r.id"), entry);
  }
});
