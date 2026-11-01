// Inline head scripts (`shared/head.ts` `inlineTag`): code never ends or swallows its element. FIX2 (r3-security#15):
// `<!--` followed by `<script` in the code entered "script data double escaped", where `</script>` does not close.
import { test } from "vitest";
import assert from "node:assert/strict";
import { headTags, inlineScript } from "../shared/head.ts";

test("inline script code: no `<!--` and no closing tag in the element, same values when run", () => {
  const code = 'window.__v = ["<!--", "<script>", `<!--${1}`, String(/<!--/u.test("a<!--b")), "</script>"].join("|");';
  const html = headTags({ scripts: [{ inline: inlineScript(code) }] });
  const body = html.slice(html.indexOf(">") + 1, html.lastIndexOf("</script>"));
  assert.ok(!body.includes("<!--"), body);
  assert.ok(!/<\/script/i.test(body), body);
  const run = (source: string) => {
    const window: { __v?: string } = {};
    new Function("window", source)(window);
    return window.__v;
  };
  assert.equal(run(body), run(code));
});
