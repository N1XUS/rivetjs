// Server-target suite: `Skeleton` SSR markup (variable is never read on the server).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Skeleton } from "../src/components/skeleton/index.ts";

test("skeleton SSR: default shimmer, prop override", async () => {
  assert.match(await renderToString(() => <Skeleton />), /class="skeleton skeleton--shimmer"/);
  assert.match(await renderToString(() => <Skeleton animationType="none" />), /class="skeleton skeleton--none"/);
});
