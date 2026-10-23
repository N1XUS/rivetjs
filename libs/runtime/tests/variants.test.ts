import { test } from "vitest";
import assert from "node:assert/strict";
import { compiledTemplate, attribute } from "../template.ts";
import { _variants, _variantTemplate, _variantValue, renderToWriter, type ServerValue } from "../server.ts";

async function render(value: unknown, variant?: number, bytes = false): Promise<string> {
  let out = "";
  const decoder = new TextDecoder();
  const writer = bytes
    ? {
        write: (s: string) => void (out += s),
        writeBytes: (b: Uint8Array) => void (out += decoder.decode(b)),
        writeInteger: (n: number) => void (out += n),
      }
    : { write: (s: string) => void (out += s) };
  await renderToWriter(value as ServerValue, writer, variant === undefined ? {} : { variant });
  return out;
}

const F = _variants([
  ["<p>Hello ", "!</p>"],
  ["<p>Hallo ", "!</p>"],
]);

test("variant selects fragment set (string and byte writers)", async () => {
  for (const bytes of [false, true]) {
    assert.equal(await render(() => _variantTemplate(F, ["Ann"]), 0, bytes), "<p>Hello Ann!</p>");
    assert.equal(await render(() => _variantTemplate(F, ["Ann"]), 1, bytes), "<p>Hallo Ann!</p>");
  }
});
test("default variant is 0; unknown variant falls back to 0", async () => {
  assert.equal(await render(() => _variantTemplate(F, ["Ann"])), "<p>Hello Ann!</p>");
  assert.equal(await render(() => _variantTemplate(F, ["Ann"]), 7), "<p>Hello Ann!</p>");
});
test("fragment sets are frozen", () => {
  assert.ok(Object.isFrozen(F) && Object.isFrozen(F.sets) && F.sets.every(Object.isFrozen));
});
test("per-variant slot order; a slot may be written twice", async () => {
  const G = _variants(
    [
      ["", " by ", ""],
      ["von ", ": ", ""],
      ["", " (", ") ", ""],
    ],
    [
      [0, 1],
      [1, 0],
      [0, 1, 0],
    ],
  );
  assert.equal(await render(() => _variantTemplate(G, ["Book", "Ann"]), 0), "Book by Ann");
  assert.equal(await render(() => _variantTemplate(G, ["Book", "Ann"]), 1), "von Ann: Book");
  assert.equal(await render(() => _variantTemplate(G, ["Book", "Ann"]), 2, true), "Book (Ann) Book");
});
test("variant value resolves in child slots, escaped", async () => {
  const v = _variantValue(["<one>", () => "zwei"]);
  const P = Object.freeze(["<b>", "</b>"]);
  assert.equal(await render(() => compiledTemplate(P, [v]), 0), "<b>&lt;one&gt;</b>");
  assert.equal(await render(() => compiledTemplate(P, [v]), 1, true), "<b>zwei</b>");
  assert.equal(await render(() => [v, " ", v], 1), "zwei zwei");
});
test("variant value resolves in attribute slots", async () => {
  const v = _variantValue(['a"b', () => 3]);
  const P = Object.freeze(["<i", "></i>"]);
  assert.equal(await render(() => compiledTemplate(P, [attribute("title", v)]), 0), '<i title="a&quot;b"></i>');
  assert.equal(await render(() => compiledTemplate(P, [attribute("title", v)]), 1, true), '<i title="3"></i>');
});
test("concurrent renders keep their own variant across awaits", async () => {
  const slow = (v: number) => () => _variantTemplate(F, [new Promise<string>((r) => setTimeout(() => r("X" + v), 5))]);
  const [a, b] = await Promise.all([render(slow(0), 0), render(slow(1), 1)]);
  assert.equal(a, "<p>Hello X0!</p>");
  assert.equal(b, "<p>Hallo X1!</p>");
});
test("each variant set is encoded once (byte writer)", async () => {
  const seen = new Set<Uint8Array>();
  const writer = { write() {}, writeBytes: (b: Uint8Array) => void seen.add(b) };
  await renderToWriter(() => _variantTemplate(F, ["a"]), writer, { variant: 1 });
  await renderToWriter(() => _variantTemplate(F, ["a"]), writer, { variant: 1 });
  assert.equal(seen.size, 2); // the two fragments of set 1, reused by the second render
});
test("String(variantValue) throws with guidance", () => {
  assert.throws(() => String(_variantValue(["a", "b"])), /use t\.in\(locale/);
});
