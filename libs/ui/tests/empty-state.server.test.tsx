// Server-target suite: `EmptyState` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { EmptyState } from "../src/components/empty-state/index.ts";

test("empty-state SSR: default text and custom children", async () => {
  assert.match(await renderToString(() => <EmptyState />), /class="empty-state"[^>]*>No results found</);
  assert.match(await renderToString(() => <EmptyState>Custom</EmptyState>), />Custom</);
});
