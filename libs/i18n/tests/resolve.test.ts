import { test } from "vitest";
import assert from "node:assert/strict";
import { localeFromPath, match, requestSource, resolveClient, resolveServer, type ResolveConfig } from "../resolve.ts";

const config: ResolveConfig = {
  locales: ["en", "de", "de-AT"],
  defaultLocale: "en",
  routing: { prefix: "as-needed" },
  cookie: { name: "rivet_locale" },
};
const req = (path: string, headers: Record<string, string> = {}) => new Request("https://x.test" + path, { headers });

test("match: exact, base language, region expansion", () => {
  assert.equal(match(["de-AT"], config.locales), "de-AT");
  assert.equal(match(["de-CH"], config.locales), "de");
  assert.equal(match(["fr", "en-GB"], config.locales), "en");
  assert.equal(match(["DE-at"], config.locales), "de-AT");
  assert.equal(match(["de"], ["en", "de-AT"]), "de-AT");
  assert.equal(match(["fr"], config.locales), undefined);
});

test("path prefix and prefix map", () => {
  assert.equal(localeFromPath("/de/cart", config), "de");
  assert.equal(localeFromPath("/de-at", config), "de-AT");
  assert.equal(localeFromPath("/cart", config), undefined);
  assert.equal(localeFromPath("/", config), undefined);
  assert.equal(localeFromPath("/at/x", { ...config, routing: { prefix: { "de-AT": "/at" } } }), "de-AT");
  assert.equal(localeFromPath("/de/x", { ...config, routing: { prefix: "never" } }), undefined);
});

test("request source: q-sorted languages, wildcard and q=0 dropped, malformed cookie kept raw (not a locale → ignored by resolve)", () => {
  const source = requestSource(
    req("/x", { "accept-language": "fr;q=0.5, *;q=0.1, de-CH, en;q=0", cookie: "a=%E0; b=x%20y" }),
  );
  assert.deepEqual(source.languages(), ["de-CH", "fr"]);
  assert.equal(source.cookie("a"), "%E0");
  assert.equal(source.cookie("b"), "x y");
});

test("server order: url beats cookie beats header", async () => {
  assert.equal(
    await resolveServer(req("/de/x", { cookie: "rivet_locale=de-AT", "accept-language": "en" }), config),
    "de",
  );
  assert.equal(
    await resolveServer(req("/x", { cookie: "rivet_locale=de-AT", "accept-language": "en" }), config),
    "de-AT",
  );
  assert.equal(await resolveServer(req("/x", { "accept-language": "fr;q=0.9, de-CH;q=0.8" }), config), "de");
  assert.equal(await resolveServer(req("/x"), config), "en");
  assert.equal(await resolveServer(req("/x", { cookie: "rivet_locale=de" }), { ...config, cookie: false }), "en");
});

test("invalid strategy results are ignored; custom and unknown strategies", async () => {
  assert.equal(await resolveServer(req("/x", { cookie: "rivet_locale=zz" }), config), "en");
  const user = { name: "user", server: async () => "de" };
  assert.equal(await resolveServer(req("/x"), config, [user, "baseLocale"]), "de");
  await assert.rejects(resolveServer(req("/x"), config, ["nope"]), /unknown strategy "nope"/);
});

test("client resolution uses browser adapters", () => {
  const g = globalThis as Record<string, unknown>;
  const navigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  g.location = { pathname: "/x" };
  g.document = { cookie: "rivet_locale=de" };
  Object.defineProperty(globalThis, "navigator", { value: { languages: ["de-AT"] }, configurable: true });
  try {
    assert.equal(resolveClient(config), "de");
    assert.equal(resolveClient(config, ["preferredLanguage"]), "de-AT");
  } finally {
    delete g.location;
    delete g.document;
    if (navigator) Object.defineProperty(globalThis, "navigator", navigator);
  }
});

test("requestSource / browserSource cookies use the router's parser (quotes, whitespace, bad percent-encoding kept)", () => {
  const source = requestSource(new Request("http://x/", { headers: { cookie: ' rivet_locale = "uk" ; other=%zz' } }));
  assert.equal(source.cookie("rivet_locale"), "uk");
  assert.equal(source.cookie("other"), "%zz");
  assert.equal(source.cookie("missing"), undefined);
});
