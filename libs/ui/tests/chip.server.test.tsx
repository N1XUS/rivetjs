// Server-target suite: `Chip` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Chip } from "../src/components/chip/index.ts";

test("chip SSR: default chip with a wrapped label", async () => {
  const html = await renderToString(() => <Chip color="danger">Hi</Chip>);
  assert.match(html, /<span[^>]*class="chip chip--danger chip--secondary"/);
  assert.match(html, /data-slot="chip"/);
  assert.match(
    html,
    /<span[^>]*class="chip__label"[^>]*data-slot="chip-label"[^>]*>Hi<\/span>|<span[^>]*data-slot="chip-label"[^>]*class="chip__label"[^>]*>Hi<\/span>/,
  );
});

test("chip SSR: element children are not wrapped", async () => {
  const html = await renderToString(() => (
    <Chip>
      <i>x</i>
    </Chip>
  ));
  assert.doesNotMatch(html, /chip__label/);
});

test("chip SSR: expression children are wrapped when they resolve to text", async () => {
  const name = "x";
  const html = await renderToString(() => <Chip>{name}</Chip>);
  assert.match(html, /chip__label/);
});

test("chip SSR: reactive expression children are wrapped (same markup as the DOM lowering)", async () => {
  const { signal } = await import("@rivetjs/reactivity");
  const saved = signal(false);
  const html = await renderToString(() => (
    <Chip color={saved() ? "success" : "default"} variant="soft" size="sm">
      {saved() ? "Saved" : "Draft"}
    </Chip>
  ));
  assert.match(html, /chip__label[^>]*>Draft</);
});
