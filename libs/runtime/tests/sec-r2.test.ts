// Lane SEC (round-2 review), node side: event type names in `data-events` (U3), SMIL `values` URLs (SEC3),
// URL objects through `prop:` (SEC4), decoder references and deep data (SEC10), Picture `style` (SEC13).
import { test } from "vitest";
import assert from "node:assert/strict";
import { resumableToString } from "../server-resume.ts";
import { createDecoder, createEncoder } from "../resume-format.ts";
import { unsafeUrl, INVALID_URL } from "../url.ts";
import { _setProp } from "../dom.ts";
import * as dom from "../dom.ts";
import { pictureHtml } from "../image-markup.ts";
import { compileResume, importServer } from "./resume/compile.ts";

test("U3: a spread handler key that is no event type name is refused, never written into data-events", async () => {
  const source = `
    import { signal } from "@rivetjs/reactivity";
    export function Spread({ k }: { k: string }) {
      const n = signal(0);
      return <div {...{ ["on" + k]: () => n.set(1) }}>{n()}</div>;
    }`;
  const server = await importServer<{ Spread(props: { k: string }): never }>(compileResume(source, "server", "src/u3.tsx").code);
  const symbols = Object.fromEntries(compileResume(source, "dom", "src/u3.tsx").symbols!.map((symbol) => [symbol.id, "/c.js"]));
  const manifest = { hash: "u3", runtime: "/rt.js", symbols };
  await assert.rejects(
    async () => String(await resumableToString(() => server.Spread({ k: 'X"><img src=x onerror=alert(1)>' }), { manifest })),
    (error: Error) => error instanceof TypeError && /event type/.test(error.message),
  );
  // Ordinary and custom names still resume.
  for (const k of ["Click", "My-event", "Rivet:update"]) {
    const html = String(await resumableToString(() => server.Spread({ k }), { manifest }));
    assert.match(html, new RegExp('data-events="' + k.toLowerCase() + '"'));
  }
});

test("SEC3: SMIL values entries are checked whole (tab / newline inside a scheme)", () => {
  assert.equal(unsafeUrl("values", " JaVa\tScRiPt:alert(1)", false), "JaVaScRiPt");
  assert.equal(unsafeUrl("values", "#a; java\nscript:alert(1)", false), "javascript");
  assert.equal(unsafeUrl("values", "#a;#b", false), undefined);
  assert.equal(unsafeUrl("values", "0;10;20", false), undefined);
  // srcset / ping keep the whitespace split: there a URL ends at whitespace.
  assert.equal(unsafeUrl("srcset", "a.png 1x,javascript:x 2x", false), "javascript");
});

test("SEC4: prop: URL objects are checked as the string the setter sees", () => {
  const link = { localName: "a" } as unknown as Element & { href?: unknown; data?: unknown };
  _setProp(link, "href", new URL("javascript:alert(1)"));
  assert.equal(link.href, INVALID_URL);
  const safe = new URL("https://example.com/x");
  _setProp(link, "href", safe);
  assert.equal(link.href, safe, "a safe URL object is assigned as is");
  // A non-URL object under a URL-named property (custom element `data`) keeps working.
  const data = { rows: [1] },
    bare = Object.create(null) as object;
  _setProp(link, "data", data);
  assert.equal(link.data, data);
  _setProp(link, "data", bare);
  assert.equal(link.data, bare);
});

test("SEC2: no export mints TrustedHTML (the Trusted Types policy is module-private)", () => {
  assert.equal("_trusted" in dom, false);
});

test("SEC10: decoder references are integer table indices; deep data fails with a clear error", () => {
  const decoder = createDecoder([1, [0], { o: ["a", 0] }]);
  assert.equal(decoder.get(0), 1);
  for (const ref of ["constructor", "__proto__", 0.5, -1, 3, NaN, "0"] as unknown as number[]) assert.throws(() => decoder.get(ref), RangeError, String(ref));
  assert.throws(() => createDecoder([[1.5]]).get(0), RangeError);
  let deep: unknown = 0;
  for (let i = 0; i < 20_000; i++) deep = [deep, 1];
  assert.throws(
    () => createEncoder().ref(deep),
    (error: Error) => error instanceof RangeError && /nested too deeply/.test(error.message),
  );
  // Ordinary depth still encodes.
  let fine: unknown = 0;
  for (let i = 0; i < 200; i++) fine = { next: fine };
  const encoder = createEncoder();
  const root = encoder.ref(fine);
  let decoded = createDecoder(JSON.parse(JSON.stringify(encoder.table))).get(root) as { next: unknown };
  for (let i = 0; i < 200; i++) decoded = decoded.next as { next: unknown };
  assert.equal(decoded, 0);
});

test("SEC13: Picture style declarations go through the style-value rule", () => {
  const image = { src: "/i.png", width: 10, height: 10, sources: [{ type: "image/png", srcset: "/i.png" }] };
  const style = (value: string) => /style="([^"]*)"/.exec(pictureHtml({ image, alt: "", style: value } as never))?.[1];
  assert.equal(style("border:0; color: red"), "border:0;color:red");
  assert.equal(style("background:url(https://t.example/x); color:red"), "color:red");
  assert.equal(style("width:expression(alert(1))"), undefined);
  assert.equal(style("--brand: #fff; bogus; :x; c\\olor:red"), "--brand:#fff");
});
