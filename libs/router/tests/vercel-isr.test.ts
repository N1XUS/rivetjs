// Vercel ISR rewrite (`adapters/vercel.ts` `isrURL`): the public prerender function `/_isr/<page>` renders only its
// own page; the deploy e2e (`deploy.test.ts`) covers the built listener.
import { test } from "vitest";
import assert from "node:assert/strict";
import { isrURL } from "../adapters/vercel.ts";

test("isrURL undoes the ISR route's rewrite for the function's own page only", () => {
  assert.equal(isrURL("/_isr/about?__rivet_path=%2Fabout&_rivet=data"), "/about?_rivet=data");
  assert.equal(isrURL("/_isr/index?__rivet_path=%2F"), "/");
  assert.equal(isrURL("/_isr/blog/a?__rivet_path=%2Fblog%2Fa"), "/blog/a");
  // Spoofs: another page through /about's function, injected query / fragment, protocol-relative.
  for (const url of [
    "/_isr/about?__rivet_path=%2Fadmin%2Fx",
    "/_isr/about?__rivet_path=%2Fabout%3F_rivet%3Ddata",
    "/_isr/about?__rivet_path=%2Fabout%23x",
    "/_isr/about?__rivet_path=%2F%2Fevil",
    "/about?__rivet_path=%2Fabout",
    "/_isr/about",
  ])
    assert.equal(isrURL(url), url, url);
});
