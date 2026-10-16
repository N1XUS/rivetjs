// Server-target suite: `Button` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button } from "../src/components/button/index.ts";

test("button SSR: classes, data-slot, disabled", async () => {
  const html = await renderToString(() => (
    <Button variant="outline" size="sm" isDisabled>
      Go
    </Button>
  ));
  assert.match(html, /<button/);
  assert.match(html, /class="button button--sm button--outline"|class="button[^"]*button--outline[^"]*"/);
  assert.match(html, /data-slot="button"/);
  assert.match(html, /disabled/);
  assert.match(html, />Go</);
});

test("button SSR: render prop element", async () => {
  const html = await renderToString(() => <Button render={(p) => <a {...(p as {})} href="/x" />}>L</Button>);
  assert.match(html, /<a[^>]*href="\/x"/);
  assert.match(html, /data-slot="button"/);
});
