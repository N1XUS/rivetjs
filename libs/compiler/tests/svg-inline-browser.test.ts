// Inline `?svg` component: server render (sanitised markup, props on the root) and, in Chromium, the client mount (DOM
// build of the component, SVG namespace, a re-created instance takes its new props). Derived resume end to end:
// libs/runtime/tests/derived-*-browser.test.ts.
import { test } from "vitest";
import assert from "node:assert/strict";
import { compile } from "../index.ts";
import { inlineSvg } from "../images/svg.ts";
import { renderToString, type ServerValue } from "../../runtime/server.ts";
import { importServer } from "../../runtime/tests/resume/compile.ts";
import { withPage, rewrite } from "../../runtime/tests/resume/harness.ts";
import type { Served } from "../../runtime/tests/resume/harness.ts";
import type { Page } from "playwright";

const { tsx } = await inlineSvg(
  "/src/logo.svg",
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="16" viewBox="0 0 48 16"><script>window.__pwned = 1</script><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><path d="M0 0h8v8H0z" fill="url(#g)" onclick="window.__pwned = 2"/><circle cx="20" cy="8" r="4"/></svg>',
  {},
  { currentColor: true },
);
const logo = (target: "server" | "dom"): string => {
  const result = compile(tsx, { target, filename: "/src/logo.svg.tsx" });
  assert.deepEqual(result.diagnostics, []);
  return result.code;
};
const PAGE = `import { signal } from "@rivetjs/reactivity";
import Logo from "./logo.svg?svg";
export function Page() {
  const on = signal(false);
  return (
    <main>
      <Logo class="static" />
      {/* Component props are snapshots (DOM): a changed prop re-creates the instance. */}
      {on() ? <Logo class="on" title="Brand" size={32} /> : <Logo class="off" title="Brand" size={32} />}
      <button id="t" onClick={() => on.set(!on())}>t</button>
    </main>
  );
}`;
const at = (code: string, url: string) => code.replaceAll('"./logo.svg?svg"', JSON.stringify(url));
const serverLogo =
  "data:text/javascript;base64," +
  Buffer.from(logo("server").replaceAll('"@rivetjs/runtime/server"', JSON.stringify(import.meta.resolve("../../runtime/server.ts")))).toString("base64");
const page = compile(PAGE, { target: "server", filename: "src/page.tsx" });
assert.deepEqual(page.diagnostics, []);
const server = await importServer<{ Page(): ServerValue }>(at(page.code, serverLogo));
const ssr = await renderToString(server.Page());
const csr = (module: string) => `<!doctype html><html><body><div id="app"></div><script type="module">
    import { mount } from "/dom.ts"; import { Page } from "${module}";
    mount(() => Page(), document.getElementById("app"));
  </script></body></html>`;
const files: Record<string, Served> = {
  "/logo.mjs": rewrite(logo("dom")),
  "/csr.mjs": at(rewrite(compile(PAGE, { target: "dom", filename: "page.tsx" }).code), "/logo.mjs"),
  "/csr": csr("/csr.mjs"),
};

const state = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main > svg")].map((svg) => ({
      cls: svg.getAttribute("class"),
      size: svg.getAttribute("width") + "x" + svg.getAttribute("height"),
      label: svg.getAttribute("role") ?? svg.getAttribute("aria-hidden"),
      tree: [svg, ...svg.querySelectorAll("*")].map((el) => el.localName + (el.namespaceURI === "http://www.w3.org/2000/svg" ? "" : "@html")).join(","),
      pwned: (window as unknown as { __pwned?: number }).__pwned ?? 0,
    })),
  );
const expected = (cls: string) => [
  { cls: "static", size: "48x16", label: "true", tree: "svg,defs,linearGradient,stop,path,circle", pwned: 0 },
  { cls, size: "32x32", label: "img", tree: "svg,title,defs,linearGradient,stop,path,circle", pwned: 0 },
];

test("server output: sanitised static markup, props on the root", () => {
  assert.match(ssr, /<svg viewBox="0 0 48 16" fill="currentColor" class="static" width="48" height="16" aria-hidden="true"><defs>/);
  assert.match(ssr, /class="off" width="32" height="32" role="img"><title>Brand<\/title>/);
  assert.doesNotMatch(ssr, /__pwned|onclick/);
});

test("client: inline SVG mounts in the SVG namespace; a re-created instance takes its new props", async () => {
  await withPage(files, async (page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://rivet.test/csr");
    await page.waitForFunction(() => document.querySelectorAll("main > svg").length === 2);
    assert.deepEqual(await state(page), expected("off"));
    await page.click("#t");
    await page.waitForFunction(() => document.querySelector("svg.on"));
    assert.deepEqual(await state(page), expected("on"));
    assert.deepEqual(errors, []);
  });
});
