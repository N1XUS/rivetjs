// Server-target suite: `dom.*` (and `../src/utils/dom.tsx`) compile for the server.
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { dom } from "../src/utils/dom.tsx";

test("dom.div renders the element with class, data-*, id and children", async () => {
  const html = await renderToString(() => (
    <dom.div class="card" data-slot="card" id="c1">
      <dom.h3 class="t">Title</dom.h3>
      <dom.p>Body</dom.p>
    </dom.div>
  ));
  assert.equal(html, '<div class="card" data-slot="card" id="c1"><h3 class="t">Title</h3><p>Body</p></div>');
});

test("dom.* render prop: replaces the element, keeps attrs and children", async () => {
  const html = await renderToString(() => (
    <dom.span class="s" data-slot="x" render={(props) => <section {...props} />}>
      <b>k</b>
    </dom.span>
  ));
  assert.equal(html, '<section class="s" data-slot="x"><b>k</b></section>');
});
