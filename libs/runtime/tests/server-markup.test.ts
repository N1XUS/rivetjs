// `_markup` (bridge ABI): framework-rendered HTML written verbatim through the trusted-fragment record.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString, template } from "@rivetjs/runtime/server";
import { _markup } from "@rivetjs/runtime/server-markup";

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
