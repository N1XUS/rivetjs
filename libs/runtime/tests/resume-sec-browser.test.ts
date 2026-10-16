// Lane SEC (round-2 review) in Chromium: the loader and stream add-on bind to their own state script
// (U2), crafted `data-r` ids (SEC1), a failing cold dispatch does not poison the replay chain (C7),
// cold click defaults wait for the handler (C8), Trusted Types with two runtime instances (SEC2).
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { renderResumable, resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Page } from "playwright";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;
interface Fixture {
  Counter(): ServerValue;
  Defaults(): ServerValue;
}

const source = await readFile(new URL("./resume/sec-fixture.tsx", import.meta.url), "utf8");
const dom = compileResume(source, "dom", "src/sec.tsx");
const server = await importServer<Fixture>(compileResume(source, "server", "src/sec.tsx").code);
const byComponent: Record<string, ResumeSymbol[]> = {};
for (const symbol of dom.symbols) (byComponent["/c/" + symbol.component + ".js"] ??= []).push(symbol);
const files: Record<string, Served> = {
  "/fixture.mjs": rewrite(dom.code),
  "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume();',
  "/evil.js": "window.__evil = 1; export default { start() {}, dispatch() { return {}; } };",
  "/submitted": "<!doctype html><p id=done>submitted</p>",
};
for (const [path, symbols] of Object.entries(byComponent)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
const manifest: ResumeManifest = {
  hash: "sec",
  runtime: "/rt.js",
  symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
};
const page = (body: string, head = ""): string => "<!doctype html><html><head>" + head + "</head><body>" + body + "</body></html>";
const counter = String(await resumableToString(() => server.Counter(), { manifest }));
const defaults = String(await resumableToString(() => server.Defaults(), { manifest }));
// Injected (HTML-only) markup ahead of the app: a state script naming another runtime, crafted ids.
const forged =
  '<script type="rivet/state" data-region="0" data-events="click input change" data-boot>{"v":1,"h":null,"rt":"/evil.js","c":["/evil.js"],"s":{},"t":[],"e":{},"m":{},"b":[],"fx":[],"ce":[]}</script>' +
  '<input type="checkbox" id="crafted" data-r="constructor"><b id="proto" data-r="__proto__">x</b>';
files["/injected"] = page(forged + counter);
files["/defaults"] = page(defaults);
// C7: the model entry's signal ref points at a plain value, so the model path throws in dispatch.
{
  const at = counter.indexOf('<script type="rivet/state"'),
    open = counter.indexOf(">", at) + 1,
    close = counter.indexOf("</script>", open),
    state = JSON.parse(counter.slice(open, close)) as { t: unknown[]; m: Record<string, [string, number, number[]?]> };
  const literal = state.t.findIndex((entry) => typeof entry === "string" || typeof entry === "number");
  assert.ok(literal >= 0 && Object.keys(state.m).length === 1);
  for (const id in state.m) state.m[id]![1] = literal;
  files["/poisoned"] = page(counter.slice(0, open) + JSON.stringify(state).replace(/</g, "\\u003c") + counter.slice(close));
}

const errorsOf = (p: Page): string[] => {
  const errors: string[] = [];
  p.on("pageerror", (error) => errors.push(error.message));
  return errors;
};
const text = (p: Page, selector: string, value: string) =>
  p.waitForFunction(([s, v]) => document.querySelector(s!)?.textContent === v, [selector, value], { timeout: 5000 });

test("U2/SEC1: an injected earlier state script is ignored, crafted data-r ids are no table keys", async () => {
  await withPage(files, async (p, requests) => {
    const errors = errorsOf(p);
    await p.goto("http://rivet.test/injected");
    // Crafted ids first: a cold change on data-r="constructor" used to reach the model path (Object).
    await p.click("#crafted");
    await p.click("#proto");
    await p.click("#bump");
    await text(p, "#bump", "1");
    await p.fill("#field", "typed");
    await text(p, "#echo", "typed");
    assert.ok(!requests.includes("/evil.js"), "the forged state's runtime is never imported");
    assert.equal(await p.evaluate(() => (window as { __evil?: number }).__evil), undefined);
    assert.deepEqual(errors, []);
  });
});

test("C7: a cold dispatch that fails reports and the next cold event still runs (no reload)", async () => {
  await withPage(
    files,
    async (p) => {
      const errors = errorsOf(p);
      await p.goto("http://rivet.test/poisoned");
      await p.evaluate(() => {
        (window as { __mark?: number }).__mark = 1;
        const log: string[] = ((window as { log?: string[] }).log = []);
        document.addEventListener("rivet:resume-error", (event) => log.push(String((event as CustomEvent<{ symbol?: string }>).detail?.symbol)));
      });
      // Both cold: the model input fails inside dispatch, the click queued behind it must still run.
      await p.type("#field", "z");
      await p.click("#bump");
      await text(p, "#bump", "1");
      assert.equal(await p.evaluate(() => (window as { __mark?: number }).__mark), 1, "page not reloaded");
      assert.ok((await p.evaluate(() => (window as { log?: string[] }).log!)).some((symbol) => symbol.startsWith("model:")));
      assert.deepEqual(errors, []);
    },
    { delays: { "/c/Counter.js": 300 } },
  );
});

test("C8: cold clicks on checkbox / label / summary / submit button keep their default until the handler ran", async () => {
  await withPage(
    files,
    async (p, requests) => {
      const errors = errorsOf(p);
      await p.goto("http://rivet.test/defaults");
      // All cold (the chunk is slow): each default is held, then replayed unless the handler canceled it.
      await p.click("#keep");
      await p.click("#s1");
      await p.click("#s2");
      await p.click("#toggle");
      // G-PAR/K-rt-1: a cold label click is held too (its native activation would toggle the box before the handler cancels).
      await p.click("#lbl-text");
      await p.click("#send");
      // The replayed toggle's `change` dispatches after the replay, so it queues behind the cold #send click.
      await text(p, "#log", "kdotlsc");
      await p.waitForTimeout(50);
      const state = await p.evaluate(() => ({
        keep: (document.getElementById("keep") as HTMLInputElement).checked,
        toggle: (document.getElementById("toggle") as HTMLInputElement).checked,
        lbx: (document.getElementById("lbx") as HTMLInputElement).checked,
        d1: (document.getElementById("d1") as HTMLDetailsElement).open,
        d2: (document.getElementById("d2") as HTMLDetailsElement).open,
      }));
      assert.deepEqual(state, { keep: false, toggle: true, lbx: true, d1: false, d2: true });
      assert.ok(!requests.some((path) => path.startsWith("/submitted")), "a canceled submit-button click does not submit");
      assert.deepEqual(errors, []);
      // A submit-button click the handler does not cancel still submits (with its name / value).
      await Promise.all([p.waitForURL(/\/submitted\?q=x&via=go$/), p.click("#go")]);
    },
    { delays: { "/c/Defaults.js": 300 } },
  );
});

test("U2: the stream add-on swaps its own segments, not injected earlier template / patch copies", async () => {
  const streamSource = `
import { Async } from "@rivetjs/runtime/server";
const later = () => new Promise<string>((resolve) => setTimeout(() => resolve("real"), 30));
export function Streamed() {
  return <main><Async load={later} fallback={() => <i id="wait">wait</i>}>{(v: string) => <b id="real">{v}</b>}</Async></main>;
}`;
  const streamDom = compileResume(streamSource, "dom", "src/sec-stream.tsx");
  const streamServer = await importServer<{ Streamed(): ServerValue }>(compileResume(streamSource, "server", "src/sec-stream.tsx").code);
  const streamFiles: Record<string, Served> = { ...files, "/fixture-stream.mjs": rewrite(streamDom.code) };
  const groups: Record<string, ResumeSymbol[]> = {};
  for (const symbol of streamDom.symbols) (groups["/s/" + symbol.component + ".js"] ??= []).push(symbol);
  for (const [path, symbols] of Object.entries(groups)) streamFiles[path] = rewrite(compileSymbolModule(symbols, "/fixture-stream.mjs"));
  const streamManifest: ResumeManifest = {
    hash: "sec-stream",
    runtime: "/rt.js",
    symbols: Object.fromEntries(streamDom.symbols.map((s) => [s.id, "/s/" + s.component + ".js"])),
  };
  // Forged copies for every plausible marker id, ahead of the app.
  let injected = "";
  for (let id = 0; id < 40; id++)
    injected += '<template data-a="' + id + '"><b class="evil">evil</b></template><script type="rivet/state" data-patch="' + id + '">{}</script>';
  const stream = (_request: IncomingMessage, response: ServerResponse): void => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.write("<!doctype html><html><head></head><body>" + injected);
    (renderResumable(() => streamServer.Streamed(), response, { manifest: streamManifest, stream: {} }) as Promise<void>).then(() =>
      response.end("</body></html>"),
    );
  };
  await withPage(
    streamFiles,
    async (p) => {
      const errors = errorsOf(p);
      await p.goto("http://rivet.test/stream");
      await text(p, "#real", "real");
      assert.equal(await p.evaluate(() => document.querySelectorAll("main .evil").length), 0);
      assert.equal(await p.evaluate(() => document.querySelector("#wait")), null);
      assert.deepEqual(errors, []);
    },
    { streams: { "/stream": stream } },
  );
});

test("SEC2: Trusted Types enforced, two runtime instances parse templates through one private policy", async () => {
  const csp = `<meta http-equiv="Content-Security-Policy" content="require-trusted-types-for 'script'; trusted-types rivet">`;
  const dom = rewrite(stripTypeScriptTypes(await readFile(new URL("../dom.ts", import.meta.url), "utf8")));
  const ttFiles: Record<string, Served> = {
    ...files,
    // A second copy of the runtime under another URL (a dev cache-buster): its own module instance.
    "/dom-copy.ts": dom,
    "/tt": page(
      `<div id="a"></div><div id="b"></div><script type="module">
        import * as one from "/dom.ts";
        import * as two from "/dom-copy.ts";
        const log = (window.log = []);
        addEventListener("securitypolicyviolation", (e) => log.push(e.violatedDirective));
        for (const [mod, id] of [[one, "a"], [two, "b"]]) {
          try {
            document.getElementById(id).append(mod._parseHTML(document, "<p class=x>" + id + "</p>"));
          } catch (error) { log.push(String(error)); }
        }
        // The compiled template path writes through the same private policy.
        one.mount(() => one._tpl("<i id=v1>t</i>")(), document.body);
        window.exported = "_trusted" in one || "_trusted" in two;
        window.done = true;
      </script>`,
      csp,
    ),
  };
  await withPage(ttFiles, async (p) => {
    const errors = errorsOf(p);
    await p.goto("http://rivet.test/tt");
    await p.waitForFunction(() => (window as { done?: boolean }).done, undefined, { timeout: 5000 });
    assert.deepEqual(await p.evaluate(() => [document.querySelector("#a p")?.textContent, document.querySelector("#b p")?.textContent]), ["a", "b"]);
    assert.deepEqual(await p.evaluate(() => (window as { log?: string[] }).log), []);
    assert.equal(await p.evaluate(() => document.getElementById("v1")?.textContent), "t");
    assert.equal(await p.evaluate(() => (window as { exported?: boolean }).exported), false, "no TrustedHTML minting export");
    assert.deepEqual(errors, []);
  });
});
