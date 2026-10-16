// Server-target suite: `Toolbar` SSR — role, classes, orientation attributes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Button, Toolbar } from "../index.ts";

test("toolbar SSR: role + classes", async () => {
  const html = await renderToString(() => (
    <Toolbar aria-label="Tools" isAttached>
      <Button>One</Button>
    </Toolbar>
  ));
  assert.match(html, /role="toolbar"/);
  assert.match(html, /class="toolbar toolbar--attached toolbar--horizontal"/);
  assert.match(html, /data-slot="toolbar"/);
  assert.match(html, /aria-orientation="horizontal"/);
});
