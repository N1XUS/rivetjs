// `_markup` (bridge ABI): framework-rendered HTML written verbatim through the trusted-fragment record.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString, template } from "@rivetjs/runtime/server";
import { _markup } from "@rivetjs/runtime/server-markup";
import { resumableToString } from "@rivetjs/runtime/server-resume";
import { compileResume, importServer, symbolUrls } from "./resume/compile.ts";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";

const html = '<div data-react="1"><b>a &amp; b</b><!-- --></div>';

test("_markup: written verbatim (no escaping)", async () => {
  assert.equal(await renderToString(_markup(html)), html);
  assert.equal(await renderToString(_markup("")), "");
  assert.equal(await renderToString([_markup("<i>1</i>"), "<&>", _markup("<i>2</i>")]), "<i>1</i>&lt;&amp;&gt;<i>2</i>");
});

test("_markup: nested inside a template slot", async () => {
  assert.equal(await renderToString(template(["<section>", "</section>"], [_markup(html)])), "<section>" + html + "</section>");
});

test("_markup: a non-string throws", () => {
  assert.throws(() => _markup(1 as unknown as string), TypeError);
  assert.throws(() => _markup(null as unknown as string), /trusted HTML/);
});

test("_markup: inside a resumable render, markers and state around it stay valid", async () => {
  const source = `
import { signal } from "@rivetjs/reactivity";
export function Host({ island }) {
  const n = signal(0);
  return <main><button onClick={() => n.set(n() + 1)}>{n()}</button><div style={{ display: "contents" }}>{island}</div></main>;
}
`;
  const symbols = compileResume(source, "dom").symbols;
  const mod = await importServer<{ Host: (props: { island: unknown }) => ReturnType<Parameters<typeof resumableToString>[0]> }>(
    compileResume(source, "server").code,
  );
  const manifest: ResumeManifest = { runtime: "/rt.js", symbols: symbolUrls(symbols) };
  const out = await resumableToString(() => mod.Host({ island: _markup(html) }), { manifest });
  assert.ok(out.includes('<div style="display:contents">' + html + "</div></main>"));
  assert.match(out, /<button data-r="0"><!--r1-->0<!--\/--><\/button>/);
  assert.match(out, /<script type="rivet\/state"/);
});
