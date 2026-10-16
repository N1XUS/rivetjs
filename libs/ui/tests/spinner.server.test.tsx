// Server-target suite: `Spinner` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Spinner } from "../src/components/spinner/index.ts";

test("spinner SSR: role=status span with the lucide icon svg", async () => {
  const html = await renderToString(() => <Spinner size="sm" color="success" />);
  assert.match(html, /<span[^>]*aria-label="Loading"/);
  assert.match(html, /role="status"/);
  assert.match(html, /class="spinner spinner--success spinner--sm"/);
  assert.match(html, /<svg[^>]*data-slot="spinner-icon"/);
});
