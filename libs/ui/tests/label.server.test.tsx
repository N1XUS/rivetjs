// Server-target suite: `Label` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Label } from "../src/components/label/index.ts";

test("label SSR: classes + data-slot", async () => {
  const html = await renderToString(() => <Label isRequired>Email</Label>);
  assert.match(html, /^<label data-slot="label" class="label label--required">Email<\/label>$/);
});
