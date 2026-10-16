// Server-target suite: `Avatar` SSR = root + fallback only; the image renders after the client probe (radix status `idle`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Avatar } from "../src/components/avatar/index.ts";

test("avatar SSR: fallback only, no img", async () => {
  const html = await renderToString(() => (
    <Avatar size="sm" color="success">
      <Avatar.Image src="/a.png" alt="A" />
      <Avatar.Fallback>AB</Avatar.Fallback>
    </Avatar>
  ));
  assert.match(html, /<span[^>]*class="avatar avatar--sm[^"]*"/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /data-slot="avatar-fallback"/);
  assert.match(html, /avatar__fallback--success/);
  assert.match(html, />AB</);
});

test("avatar SSR: a delayed fallback renders nothing", async () => {
  const html = await renderToString(() => (
    <Avatar>
      <Avatar.Fallback delayMs={300}>AB</Avatar.Fallback>
    </Avatar>
  ));
  assert.doesNotMatch(html, /avatar-fallback/);
});
