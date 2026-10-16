// Server-target suite: `Separator` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Separator } from "../src/components/separator/index.ts";

test("separator SSR: hr with classes and data attributes", async () => {
  const html = await renderToString(() => <Separator variant="tertiary" class="my-2" />);
  assert.match(html, /<hr[^>]*class="separator separator--horizontal separator--tertiary my-2"/);
  assert.match(html, /data-slot="separator"/);
  assert.match(html, /data-orientation="horizontal"/);
});

test("separator SSR: vertical = div role=separator aria-orientation", async () => {
  const html = await renderToString(() => <Separator orientation="vertical" />);
  assert.match(html, /<div[^>]*role="separator"/);
  assert.match(html, /aria-orientation="vertical"/);
});
