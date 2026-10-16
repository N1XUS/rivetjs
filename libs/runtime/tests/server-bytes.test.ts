import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { compile } from "@rivetjs/compiler";
import { NodeStreamWriter } from "../node.ts";
import type { renderToString, renderToWriter, ServerValue } from "../server.ts";

interface RenderExports {
  renderToString: typeof renderToString;
  renderToWriter: typeof renderToWriter;
}

const runtimeURL = new URL("../server.ts", import.meta.url).href;
async function load<T>(source: string): Promise<T & RenderExports> {
  const { code, diagnostics } = compile(source, { target: "server", filename: "bytes.tsx" });
  assert.deepEqual(diagnostics, []);
  return (await import("data:text/javascript," + encodeURIComponent(code.replaceAll("@rivetjs/runtime/server", runtimeURL)))) as T &
    RenderExports;
}
function sink(delay: boolean) {
  const parts: Buffer[] = [];
  const stream = new Writable({ highWaterMark: 64, write(chunk: Uint8Array, _encoding: BufferEncoding, done: (error?: Error | null) => void) { parts.push(Buffer.from(chunk)); delay ? setTimeout(done, 0) : done(); } });
  return { stream, text: () => Buffer.concat(parts).toString() };
}

test("byte writer path matches string rendering for numbers, attributes and hostile text", async () => {
  const { page, renderToString, renderToWriter } = await load<{ page: (values: number[], text: string) => ServerValue }>(`import { renderToString, renderToWriter } from '@rivetjs/runtime/server';
    export { renderToString, renderToWriter };
    const Row = ({ v }) => <li data-n={v} hidden={v} tabIndex={v} title={String(v)} href={v}>{v}|{-v}|{v / 3}|{v * 1e20}</li>;
    export const page = (values, text) => <ul data-count={values.length} class={text}>{text}{values.map(v => <Row v={v} />)}{null}{false}{true}{0}{-0}{1n}</ul>;`);
  const values = [0, -0, 1, -1, 7, 1e21, 2 ** 53, -(2 ** 53), NaN, Infinity, 123456789];
  const text = "<&>\"'😀\ud800" + "x".repeat(20000);
  const expected = renderToString(page(values, text)) as string;
  for (const delay of [false, true]) {
    const target = sink(delay);
    const writer = new NodeStreamWriter(target.stream, { threshold: 128 });
    await renderToWriter(page(values, text), writer);
    await writer.finish();
    await new Promise<void>((resolve) => target.stream.end(resolve));
    assert.equal(target.text(), Buffer.from(expected).toString(), `delay=${delay}`);
  }
});

test("byte writer path still neutralizes unsafe URL strings and aborts under backpressure", async () => {
  const { link, renderToWriter } = await load<{ link: (href: string, n: number) => ServerValue }>(`import { renderToWriter } from '@rivetjs/runtime/server';
    export { renderToWriter };
    export const link = (href, n) => <p>{Array.from({ length: n }, (_, i) => <a data-i={i} href={href}>{i}</a>)}</p>;`);
  const target = sink(false);
  const writer = new NodeStreamWriter(target.stream);
  await renderToWriter(link("javascript:alert(1)", 1), writer);
  await writer.finish();
  await new Promise<void>((resolve) => target.stream.end(resolve));
  assert.equal(target.text(), '<p><a data-i="0" href="about:invalid#rivet">0</a></p>');
  const controller = new AbortController();
  const slow = sink(true);
  const rendering = renderToWriter(link("/ok", 5000), new NodeStreamWriter(slow.stream, { threshold: 64, maxBuffered: 0, signal: controller.signal }), { signal: controller.signal }) as Promise<void>;
  setTimeout(() => controller.abort(new Error("stop")), 5);
  await assert.rejects(rendering, /stop/);
});
