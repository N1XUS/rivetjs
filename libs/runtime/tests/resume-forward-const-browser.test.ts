// Forward boxes over constant getters (IMPL-EAGER, 2026-10-09). A component that forwards its props through
// `splitProps` (`<Inner {...rest} tone={local.tone} />`) hands the child getters whose source is its own live props
// recipe; a handler in the child capturing them reached that recipe, so the parent's chunk counted as needed and was
// preloaded on visibility (starter-ui: ui ButtonRoot + tailwind-merge loaded before any interaction). A source getter
// that reads no signal is now encoded as its value: the parent chunk is not needed, a live value still forwards.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { compileResume, compileSymbolModule, importServer } from "./resume/compile.ts";
import type { ResumeSymbol } from "./resume/compile.ts";
import { withPage, rewrite } from "./resume/harness.ts";
import type { Served } from "./resume/harness.ts";

type ServerValue = ReturnType<Parameters<typeof resumableToString>[0]>;

const source = `
import { signal } from "@rivetjs/reactivity";
import { splitProps } from "@rivetjs/runtime/props";
type P = { id: string; label?: string; tone?: string };
function Inner(props: P) {
  const [own] = splitProps(props, ["label", "tone"]);
  const out = signal("-");
  return <button id={props.id} onClick={() => out.set(own.label + ":" + own.tone)}>{out()}</button>;
}
function Root(props: P) {
  const [local, rest] = splitProps(props, ["tone"]);
  return <Inner {...rest} tone={local.tone} />;
}
export function Static() {
  return <main><Root id="a" label="x" tone="t" /></main>;
}
export function Live() {
  const tone = signal("t");
  return <main>
    <button id="go" onClick={() => tone.set(tone() + "2")}>go</button>
    <Root id="b" label="y" tone={tone()} />
  </main>;
}
`;

const setup = async () => {
  const dom = compileResume(source, "dom", "src/fwd.tsx");
  const server = await importServer<{ Static(): ServerValue; Live(): ServerValue }>(compileResume(source, "server", "src/fwd.tsx").code);
  const groups: Record<string, ResumeSymbol[]> = {};
  for (const symbol of dom.symbols) (groups["/c/" + symbol.component + ".js"] ??= []).push(symbol);
  const manifest: ResumeManifest = {
    hash: "fwd",
    runtime: "/rt.js",
    symbols: Object.fromEntries(dom.symbols.map((s) => [s.id, "/c/" + s.component + ".js"])),
  };
  const files: Record<string, Served> = {
    "/fixture.mjs": rewrite(dom.code),
    "/rt.js": 'import { createResume } from "/dom-resume.ts"; export default createResume({});',
  };
  for (const [path, symbols] of Object.entries(groups)) files[path] = rewrite(compileSymbolModule(symbols, "/fixture.mjs"));
  const page = async (render: () => ServerValue) =>
    "<!doctype html><html><head></head><body>" + (await resumableToString(render, { manifest })) + "</body></html>";
  return { server, files, page };
};

// Chunks the page state names (`c`): every chunk a recorded handler / binding needs.
const chunks = (html: string): string[] => JSON.parse(/<script type="rivet\/state"[^>]*>(.*?)<\/script>/.exec(html)![1]!).c;

test("static forwarded props do not make the parent's chunk needed; the handler sees their values", async () => {
  const { server, files, page } = await setup();
  const html = await page(() => server.Static());
  assert.deepEqual(chunks(html), ["/c/Inner.js"]);
  await withPage({ ...files, "/": html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    await p.click("#a");
    await p.waitForFunction(() => document.getElementById("a")!.textContent === "x:t", null, { timeout: 2000 });
    assert.deepEqual(errors, []);
  });
});

test("a live forwarded prop still forwards through the parent's recipe", async () => {
  const { server, files, page } = await setup();
  const html = await page(() => server.Live());
  assert.ok(chunks(html).includes("/c/Root.js"), chunks(html).join());
  await withPage({ ...files, "/": html }, async (p) => {
    const errors: string[] = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.goto("http://rivet.test/");
    await p.click("#go");
    await p.click("#b");
    await p.waitForFunction(() => document.getElementById("b")!.textContent === "y:t2", null, { timeout: 2000 });
    assert.deepEqual(errors, []);
  });
});
