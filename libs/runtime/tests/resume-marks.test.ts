// Resume marker ids (`<!--rN-->` / `<!--rN[-->`, MARK records): the writer leaves N out when it continues the
// stride of the two marks written before it, in write order, on string and byte writers alike; resets, raw
// template fragments and failed ErrorBoundary content restart or restore the chain (docs/resume.md "Marker ids").
import { test } from "vitest";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { NodeStreamWriter } from "../node.ts";
import { ErrorBoundary, renderToString, renderToWriter } from "../server.ts";
import { compiledTemplate, template, _markFragments, MARK_CHAIN, MARK_KEEP, MARK_RESET } from "../template.ts";

type Value = Parameters<typeof renderToString>[0];
const TEXT = _markFragments(["<!--r", "-->", "<!--/-->"], MARK_CHAIN);
const KEPT = _markFragments(["<!--r", "-->", "<!--/-->"], MARK_KEEP);
const text = (id: number, mode = MARK_CHAIN): Value => compiledTemplate(mode === MARK_KEEP ? KEPT : TEXT, [id, "t" + id]) as Value;
const reset = compiledTemplate(_markFragments(["", ""], MARK_RESET), [0]) as Value;
// Nested in one compiled record too: the byte writer's raw slab path (rawPut / rawSize + rawWrite).
const nested = (values: Value[]): Value => compiledTemplate(["<p>", ...values.slice(1).map(() => ""), "</p>"], values) as Value;
const bytes = async (value: Value): Promise<string> => {
  const parts: Buffer[] = [];
  const sink = new Writable({ write: (chunk: Buffer, _encoding, done) => (parts.push(Buffer.from(chunk)), done()) });
  const writer = new NodeStreamWriter(sink, { threshold: 64, early: false });
  await renderToWriter(value, writer);
  await writer.finish();
  return Buffer.concat(parts).toString("utf8");
};
// Marker starts only, `N` or "" per start.
const ids = (html: string): string[] => [...html.matchAll(/<!--r(\d*)\[?-->/g)].map((match) => match[1]!);
async function check(make: () => Value[], expected: string[]): Promise<void> {
  assert.deepEqual(ids(await renderToString(make())), expected, "string writer");
  assert.deepEqual(ids(await bytes(make())), expected, "byte writer");
  assert.deepEqual(ids(await renderToString(nested(make()))), expected, "string writer, one record");
  assert.deepEqual(ids(await bytes(nested(make()))), expected, "byte writer, one record");
}

test("marker ids: a mark continuing the stride of the two before it is left out", async () => {
  await check(() => [text(5), text(6), text(7), text(8)], ["5", "6", "", ""]);
  await check(() => [text(9), text(7), text(5), text(6), text(7)], ["9", "7", "", "6", ""]);
  // Always-written marks (a streamed boundary) still count for the stride.
  await check(() => [text(5), text(6), text(7, MARK_KEEP), text(8)], ["5", "6", "7", ""]);
});

test("marker ids: a reset and raw template fragments restart the chain (the next two are written)", async () => {
  await check(() => [text(5), text(6), reset, text(7), text(8), text(9)], ["5", "6", "7", "8", ""]);
  await check(() => [text(5), text(6), template(["<i>", "</i>"], [text(7)]) as Value, text(8), text(9)], ["5", "6", "7", "8", "9"]);
  // (`</i>` resets again after 7: 8 and 9 are written.) An empty fragment carries no markup: no reset.
  await check(() => [text(5), text(6), template(["", ""], [text(7)]) as Value, text(8)], ["5", "6", "", ""]);
});

test("marker ids: failed ErrorBoundary content restores the chain its marks advanced", async () => {
  const boundary = (): Value =>
    ErrorBoundary({
      fallback: () => "fallback",
      children: () => [
        text(7),
        text(8),
        () => {
          throw new Error("boom");
        },
      ],
    } as never) as Value;
  // 7 and 8 were never written: 9 does not continue 5, 6 (the browser would read 7).
  await check(() => [text(5), text(6), boundary(), text(9), text(10)], ["5", "6", "9", "10"]);
  const html = await renderToString([text(5), text(6), boundary(), text(9)]);
  assert.match(html, /fallback/);
  assert.doesNotMatch(html, /t7|t8/);
});
