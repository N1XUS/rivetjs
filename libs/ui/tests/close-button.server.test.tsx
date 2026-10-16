// Server-target suite: `CloseButton` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { CloseButton } from "../src/components/close-button/index.ts";

test("close-button SSR: aria-label, type, classes, icon", async () => {
  const html = await renderToString(() => <CloseButton />);
  assert.match(html, /aria-label="Close"/);
  assert.match(html, /type="button"/);
  assert.match(html, /data-slot="close-button"/);
  assert.match(html, /close-button--default/);
  assert.match(html, /<svg[^>]*data-slot="close-button-icon"/);
});
