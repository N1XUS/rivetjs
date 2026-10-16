// Function Bridge T4 fix round 1 (M1): holder functions whose captures are still in their TDZ where they are created stay
// plain (compiler `resume/escape.rs` `uninitialized_at`), so the page renders when the holder is never encoded.
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer } from "./resume/compile.ts";

const page = (body: string) => `import { signal } from "@rivetjs/reactivity";
export function Page() {
  const n = signal(0);
  const show = Number("0") > 0;
  ${body}
  return <main>{show && <button onClick={() => go()}>{n()}</button>}</main>;
}`;
async function render(source: string): Promise<string> {
  const symbols = compileResume(source, "dom").symbols;
  const manifest = { runtime: "/rt.js", symbols: Object.fromEntries(symbols.map((symbol) => [symbol.id, "/c.js"])) };
  const mod = await importServer<{ Page(): never }>(compileResume(source, "server").code);
  return (await resumableToString(() => mod.Page(), { manifest } as never)) as string;
}

test("a let holder capturing itself in its own initializer renders (holder only in an unrendered branch)", async () => {
  const html = await render(page("let retry = (): unknown => setTimeout(retry, 500); const go = () => retry();"));
  assert.match(html, /<main>/);
});

test("a holder function capturing a binding declared later renders", async () => {
  const html = await render(
    page("const api: { close?: () => void } = {}; api.close = () => stop(); const stop = () => n.set(0); const go = () => api.close!();"),
  );
  assert.match(html, /<main>/);
});

test("a holder function inside a hoisted helper called before the binding it captures renders", async () => {
  const html = await render(
    page(
      "const api: { close?: () => void } = {}; setup(); const stop = () => n.set(0); function setup() { api.close = () => stop(); } const go = () => api.close!();",
    ),
  );
  assert.match(html, /<main>/);
});
