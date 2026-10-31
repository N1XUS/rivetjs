import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { StreamingText } from "../src/components/streaming-text/index.ts";

test("streaming text SSR: complete text, safe escaping and intact graphemes", async () => {
  const html = await renderToString(() => <StreamingText content="A👩🏽‍💻é<" isStreaming class="custom" />);
  assert.match(html, /class="streaming-text custom"/);
  assert.match(html, />👩🏽‍💻<\/span>/);
  assert.match(html, />é<\/span>/);
  assert.match(html, /&lt;/);
  assert.doesNotMatch(html, /aria-live|data-revealing|data-new/);
});
