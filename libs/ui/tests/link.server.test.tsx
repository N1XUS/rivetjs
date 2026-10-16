// Server-target suite: `Link` SSR markup.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Link } from "../src/components/link/index.ts";

test("link SSR: anchor with link__icon default icon", async () => {
  const html = await renderToString(() => (
    <Link href="/a">
      Go <Link.Icon />
    </Link>
  ));
  assert.match(html, /<a[^>]*href="\/a"/);
  assert.match(html, /data-slot="link"/);
  assert.match(html, /class="link"|class="link /);
  assert.match(html, /link__icon/);
  assert.match(html, /data-default-icon="true"/);
  assert.match(html, /data-slot="link-default-icon"/);
});
