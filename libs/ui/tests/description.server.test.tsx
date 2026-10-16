// Server-target suite: `Description` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Description } from "../src/components/description/index.ts";

test("description SSR: span with class + data-slot", async () => {
  const html = await renderToString(() => <Description class="x">T</Description>);
  assert.match(html, /^<span data-slot="description" slot="description" class="description x">T<\/span>$/);
});
