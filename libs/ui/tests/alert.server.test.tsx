// Server-target suite: `Alert` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Alert } from "../src/components/alert/index.ts";

test("alert SSR: status class, parts and the default icon", async () => {
  const html = await renderToString(() => (
    <Alert status="success">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Done</Alert.Title>
        <Alert.Description>It worked</Alert.Description>
      </Alert.Content>
    </Alert>
  ));
  assert.match(html, /class="alert alert--success"/);
  assert.match(html, /data-slot="alert-root"/);
  assert.match(html, /class="alert__indicator"/);
  assert.match(html, /<svg[^>]*data-slot="alert-default-icon"/);
  assert.match(html, /<p[^>]*class="alert__title"[^>]*>Done<\/p>|<p[^>]*data-slot="alert-title"[^>]*>Done<\/p>/);
  assert.match(html, /alert__description/);
});
