// Server-target suite: `Header` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Header } from "../src/components/header/index.ts";

test("header SSR: <header class='header …' data-slot='header'>", async () => {
  const html = await renderToString(() => <Header class="x">H</Header>);
  assert.match(html, /^<header data-slot="header" class="header x">H<\/header>$/);
});
