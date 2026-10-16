// Server-target suite: `ErrorMessage` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { ErrorMessage } from "../src/components/error-message/index.ts";

test("error-message SSR: span with class + data-slot", async () => {
  const html = await renderToString(() => <ErrorMessage class="x">T</ErrorMessage>);
  assert.match(html, /^<span data-slot="error-message" slot="errorMessage" class="error-message x">T<\/span>$/);
});
