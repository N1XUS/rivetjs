// Server-target suite: `Markdown` `components` override map on the server (SSR string): overridden tags appear with the default
// classes, safe links still dropped (overrides never see `javascript:` URLs), raw HTML stays text.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Markdown } from "../src/components/markdown/index.ts";

test("markdown components SSR: overrides render, safety kept", async () => {
  const html = await renderToString(() => (
    <Markdown
      content={"# Title\n\n[ok](https://example.com) [bad](javascript:alert(1)) `c` <b>raw</b>\n\n- [ ] todo\n\n```py\nprint(1)\n```"}
      components={{
        h1: (p) => <h2 class={p.class}>{p.children}</h2>,
        a: (p) => (
          <a class={p.class} href={p.href} data-custom="a">
            {p.children}
          </a>
        ),
        code: (p) => <kbd>{p.children}</kbd>,
        pre: (p) => <pre data-lang={p.language}>{p.code}</pre>,
        input: (p) => <input type="checkbox" checked={p.checked} disabled data-custom="input" />,
      }}
    />
  ));
  assert.match(html, /<h2 class="markdown__heading markdown__heading--1">Title<\/h2>/);
  assert.doesNotMatch(html, /<h1/);
  assert.match(html, /<a class="markdown__link" href="https:\/\/example.com" data-custom="a">ok<\/a>/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<kbd>c<\/kbd>/);
  assert.match(html, /&lt;b&gt;raw&lt;\/b&gt;/);
  assert.match(html, /<pre data-lang="py">print\(1\)<\/pre>/);
  assert.doesNotMatch(html, /code-block/);
  assert.match(html, /data-custom="input"/);
});
