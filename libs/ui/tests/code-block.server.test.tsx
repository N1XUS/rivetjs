// Server-target suite: `CodeBlock` SSR (Rivet-authored; feature set inspired by HeroUI Pro's public CodeBlock docs):
// header + language label, focusable region, token spans, raw HTML escaped, copy button.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CodeBlock } from "../src/components/code-block/index.ts";

test("code-block SSR", async () => {
  const code = 'const a = "<b>";';
  const html = await renderToString(() => (
    <CodeBlock>
      <CodeBlock.Header>
        <CodeBlock.Language language="ts" />
        <CodeBlock.CopyButton code={code} />
      </CodeBlock.Header>
      <CodeBlock.Code code={code} language="ts" />
    </CodeBlock>
  ));
  assert.match(html, /class="code-block"/);
  assert.match(html, /code-block__language[^>]*>TypeScript</);
  assert.match(html, /role="region" tabindex="0" aria-label="TypeScript code"/);
  assert.match(html, /<span class="code-block__token code-block__token--keyword">const<\/span>/);
  assert.match(html, /&lt;b>|&lt;b&gt;/);
  assert.doesNotMatch(html, /<b>/);
  assert.match(html, /aria-label="Copy code"/);
});
