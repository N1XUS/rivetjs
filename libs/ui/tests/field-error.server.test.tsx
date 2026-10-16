// Server-target suite: `FieldError` SSR markup (invalid field shows the message, valid renders nothing).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { TextField } from "@rivetjs/cdk/text-field";
import { FieldError } from "../src/components/field-error/index.ts";

test("field-error SSR: invalid shows message with class + data-slot", async () => {
  const html = await renderToString(() => (
    <TextField isInvalid name="email">
      <FieldError>Enter a valid email</FieldError>
    </TextField>
  ));
  assert.match(html, /class="field-error"/);
  assert.match(html, /data-slot="field-error"/);
  assert.match(html, /Enter a valid email/);
});

test("field-error SSR: valid renders nothing", async () => {
  const html = await renderToString(() => (
    <TextField name="email">
      <FieldError>Enter a valid email</FieldError>
    </TextField>
  ));
  assert.doesNotMatch(html, /field-error/);
});
