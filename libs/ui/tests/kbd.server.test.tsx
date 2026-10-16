// Server-target suite: `Kbd` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Kbd } from "../src/components/kbd/index.ts";

test("kbd SSR: parts with variant slot classes", async () => {
  const html = await renderToString(() => (
    <Kbd variant="default">
      <Kbd.Abbr keyValue="enter" />
      <Kbd.Content>Go</Kbd.Content>
    </Kbd>
  ));
  assert.match(html, /<kbd[^>]*class="kbd kbd--default"/);
  assert.match(html, /<abbr[^>]*class="kbd__abbr"[^>]*title="Enter"[^>]*>↵<\/abbr>/);
  assert.match(html, /<span[^>]*class="kbd__content"[^>]*>Go<\/span>/);
});
