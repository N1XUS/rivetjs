// Server-target suite: `Badge` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Badge } from "../src/components/badge/index.ts";

test("badge SSR: anchor + wrapped label", async () => {
  const html = await renderToString(() => (
    <Badge.Anchor>
      <Badge color="accent">9</Badge>
    </Badge.Anchor>
  ));
  assert.match(html, /class="badge-anchor"/);
  assert.match(html, /class="badge badge--accent[^"]*"/);
  assert.match(html, /badge__label/);
  assert.match(html, />9</);
});
