// canonical() shares the router's trailing-slash policy (review round 2, X4): same values, same
// `slashPath` (file paths stay unslashed), default = the app's `rivetRouter({ trailingSlash })`.
import { test, expectTypeOf } from "vitest";
import assert from "node:assert/strict";
import type { TrailingSlash } from "@rivetjs/router";
import { canonical, type CanonicalOptions } from "../shared.ts";

test("canonical trailingSlash: router policy values, file paths unslashed, default follows TRAILING_SLASH (ignore)", () => {
  expectTypeOf<NonNullable<CanonicalOptions["trailingSlash"]>>().toEqualTypeOf<TrailingSlash>();
  const base = { baseUrl: "https://a.test" };
  assert.equal(canonical("/feed.xml", { ...base, trailingSlash: "always" }).href, "https://a.test/feed.xml");
  assert.equal(canonical("/a/b", { ...base, trailingSlash: "always" }).href, "https://a.test/a/b/");
  assert.equal(canonical("/a/b/", { ...base, trailingSlash: "never" }).href, "https://a.test/a/b");
  assert.equal(canonical("/", { ...base, trailingSlash: "never" }).href, "https://a.test/");
  assert.equal(canonical("/a/", { ...base, trailingSlash: "ignore" }).href, "https://a.test/a/");
  // No option: the build constant (unset in tests → "ignore"), so URLs stay as written.
  assert.equal(canonical("/a/", base).href, "https://a.test/a/");
  assert.equal(canonical("/a", base).href, "https://a.test/a");
});
