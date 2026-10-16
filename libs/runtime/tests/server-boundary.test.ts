import { test } from "vitest";
import assert from "node:assert/strict";
import * as compiler from "@rivetjs/compiler";
import { renderToString, renderToWriter, ErrorBoundary, compiledTemplate } from "@rivetjs/runtime/server";
import type { ServerValue } from "@rivetjs/runtime/server";
import { importServer } from "./resume/compile.ts";

type View = () => ServerValue;
const source = `
import { Async, ErrorBoundary } from "@rivetjs/runtime/server";
const message = (error) => (error instanceof Error ? error.message : String(error));
function Boom({ when }) {
  if (when) throw new Error('<b>"boom" & co</b>');
  return <b>fine</b>;
}
export const sync = (when) => () => <main>
  <h1>before</h1>
  <ErrorBoundary fallback={(error) => <p class={message(error)}>{message(error)}</p>}>{() => <section><i>partial</i><Boom when={when} /></section>}</ErrorBoundary>
  <footer>after</footer>
</main>;
export const later = (gate) => () => <main>
  <h1>before</h1>
  <ErrorBoundary fallback={(error) => <p>{message(error)}</p>}>{() => <section>
    <i>partial</i>
    <Async load={() => gate}>{(value) => <b>{value}</b>}</Async>
  </section>}</ErrorBoundary>
  <ErrorBoundary fallback={() => <p>wrong boundary</p>}>{() => <Async load={() => Promise.reject(new Error("own"))} error={(error) => <u>{message(error)}</u>}>{(value) => value}</Async>}</ErrorBoundary>
  <footer>after</footer>
</main>;
export const deferred = () => <div><ErrorBoundary fallback={(error) => <p>{message(error)}</p>}>{() => [<i>x</i>, () => { throw new Error("deferred child"); }]}</ErrorBoundary><b>y</b></div>;
export const nested = () => <ErrorBoundary fallback={(error) => <p>outer {message(error)}</p>}>{() => <ErrorBoundary fallback={() => { throw new Error("fallback failed"); }}>{() => <Boom when />}</ErrorBoundary>}</ErrorBoundary>;
export const bare = () => <main><Boom when /></main>;
export const plain = (when) => () => <main><ErrorBoundary fallback={(error) => <p>{message(error)}</p>}><i>partial</i><Boom when={when} /></ErrorBoundary></main>;
`;
const compiled = compiler.compile(source, { target: "server", filename: "boundary.tsx" });
assert.deepEqual(compiled.diagnostics, []);
const mod = await importServer<{
  sync(when: boolean): View;
  later(gate: Promise<string>): View;
  deferred(): unknown;
  nested(): unknown;
  bare(): unknown;
  plain(when: boolean): View;
}>(compiled.code);

const ESCAPED = "&lt;b&gt;&quot;boom&quot; &amp; co&lt;/b&gt;";

test("server ErrorBoundary: a synchronous children error renders the escaped fallback in place; siblings intact", () => {
  const html = renderToString(mod.sync(true));
  assert.equal(typeof html, "string", "stays synchronous");
  assert.equal(html, `<main><h1>before</h1><p class="${ESCAPED}">${ESCAPED.replace(/&quot;/g, '"')}</p><footer>after</footer></main>`);
  assert.equal(renderToString(mod.sync(false)), "<main><h1>before</h1><section><i>partial</i><b>fine</b></section><footer>after</footer></main>");
});

test("server ErrorBoundary: an awaited Async rejection without its own error renders the fallback; no partial bytes", async () => {
  let reject!: (error: unknown) => void;
  const gate = new Promise<string>((_, no) => (reject = no));
  const chunks: string[] = [];
  const done = renderToWriter(mod.later(gate)() as never, { write: (chunk) => void chunks.push(chunk) });
  await new Promise((resolve) => setTimeout(resolve, 5));
  // Output before the boundary streams; the boundary's own content is buffered.
  assert.equal(chunks.join(""), "<main><h1>before</h1>");
  reject(new Error("load failed"));
  await done;
  assert.equal(chunks.join(""), "<main><h1>before</h1><p>load failed</p><u>own</u><footer>after</footer></main>");
  // Resolved: buffered content is written as one string chunk, in order.
  const html = await renderToString(mod.later(Promise.resolve("ok")));
  assert.equal(html, "<main><h1>before</h1><section><i>partial</i><b>ok</b></section><u>own</u><footer>after</footer></main>");
});

test("server ErrorBoundary: deferred child errors, nested fallback failures and byte writers", async () => {
  assert.equal(renderToString(mod.deferred() as never), "<div><p>deferred child</p><b>y</b></div>");
  assert.equal(renderToString(mod.nested() as never), "<p>outer fallback failed</p>");
  // Byte writers receive the buffered fragments and integers in order, after the boundary completes.
  const calls: unknown[] = [];
  const writer = {
    write: (chunk: string) => void calls.push(chunk),
    writeBytes: (bytes: Uint8Array) => void calls.push(new TextDecoder().decode(bytes)),
    writeInteger: (value: number) => {
      calls.push(value);
      return Promise.resolve();
    },
  };
  await renderToWriter(ErrorBoundary({ fallback: () => "no", children: () => compiledTemplate(["<a>", "</a><b>", "</b>"], [7, "x"]) }) as never, writer);
  assert.deepEqual(calls, ["<a>", 7, "</a><b>", "x", "</b>"]);
});

test("server ErrorBoundary: request abort is not caught; no boundary rejects as before", async () => {
  const controller = new AbortController();
  const done = renderToString(mod.later(new Promise<string>(() => {})), { signal: controller.signal });
  controller.abort(new Error("aborted"));
  await assert.rejects(done as Promise<string>, /aborted/);
  await assert.rejects(Promise.resolve(renderToString(mod.bare as never)), /boom/);
});

test("server ErrorBoundary: plain JSX children (thunked by the compiler) are caught", () => {
  assert.equal(renderToString(mod.plain(true)), `<main><p>${ESCAPED.replace(/&quot;/g, '"')}</p></main>`);
  assert.equal(renderToString(mod.plain(false)), "<main><i>partial</i><b>fine</b></main>");
});
