import { test } from "vitest";
import assert from "node:assert/strict";
import type { CookieOptions, HttpError, RequestEvent } from "@rivetjs/router";
import { alternates, delocalizeHref, dirOf, errorLocale, i18nGuard, localizeHref, setLocale, type I18nRouteConfig } from "../router.ts";
import { localeCookie } from "../resolve.ts";

const config: I18nRouteConfig = {
  locales: ["en", "de"],
  defaultLocale: "en",
  routing: { prefix: "as-needed" },
  baseUrl: "https://x.test",
};
const event = (path: string, headers: Record<string, string> = {}, params: Record<string, string> = {}, origin = "https://x.test") => {
  const set = new Map<string, string>();
  const cookies: [string, string, CookieOptions | undefined][] = [];
  const request = new Request(origin + path, { headers });
  const e: RequestEvent = {
    request,
    url: new URL(request.url),
    params,
    locals: {},
    signal: new AbortController().signal,
    platform: {},
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: (name, value, options) => void cookies.push([name, value, options]),
      delete() {},
    },
    setHeader: (k, v) => void set.set(k, v),
    setHeaders: (values) => Object.entries(values).forEach(([k, v]) => set.set(k, v)),
    route: { id: null },
    isDataRequest: false,
    depends: () => {},
  };
  return { e, set, cookies };
};
// A followed link / submitted form on this site, as browsers send it.
const clicked = { "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate" };
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => assert.fail("expected the guard to throw"),
    (error: HttpError) => error,
  );

test("localize / delocalize", () => {
  assert.equal(localizeHref("/cart?x=1", "de", config), "/de/cart?x=1");
  assert.equal(localizeHref("/de/cart", "en", config), "/cart");
  assert.equal(localizeHref("/de", "en", config), "/");
  assert.equal(localizeHref("/", "de", config), "/de");
  assert.equal(delocalizeHref("/de/cart#a", config), "/cart#a");
  assert.equal(localizeHref("/cart", "en", { ...config, routing: { prefix: "always" } }), "/en/cart");
  assert.equal(localizeHref("/cart", "de", { ...config, routing: { prefix: { de: "/deutsch" } } }), "/deutsch/cart");
  assert.equal(localizeHref("/de/cart", "de", { ...config, routing: { prefix: "never" } }), "/de/cart");
});

test("localize / delocalize under an app base: the locale prefix follows the base", () => {
  assert.equal(localizeHref("/shop", "de", config, "/shop"), "/shop/de");
  assert.equal(localizeHref("/shop/", "de", config, "/shop"), "/shop/de");
  assert.equal(localizeHref("/shop/cart?x=1#a", "de", config, "/shop"), "/shop/de/cart?x=1#a");
  assert.equal(localizeHref("/shop/de/cart", "en", config, "/shop"), "/shop/cart");
  assert.equal(localizeHref("/shop/de", "en", config, "/shop"), "/shop/");
  assert.equal(delocalizeHref("/shop/de/cart", config, "/shop"), "/shop/cart");
  // A first segment named like a locale is the base, not a prefix.
  assert.equal(delocalizeHref("/de/cart", config, "/de"), "/de/cart");
  // Paths outside the base: as without one.
  assert.equal(localizeHref("/cart", "de", config, "/shop"), "/de/cart");
});

test("guard sets locale, dir and content-language from the lang param", async () => {
  const { e, set } = event("/de/cart", {}, { lang: "de" });
  assert.equal(await i18nGuard(config)(e), undefined);
  assert.deepEqual(e.locals, { locale: "de", dir: "ltr" });
  assert.equal(set.get("content-language"), "de");
  assert.equal(set.has("vary"), false);
});

test("guard 404s an unknown lang param", async () => {
  const error = await failure(i18nGuard(config)(event("/zz/cart", {}, { lang: "zz" }).e));
  assert.equal(error.status, 404);
});

test("guard: unprefixed URLs redirect to a preferred non-default locale", async () => {
  const root = event("/?q=1", { "accept-language": "de" });
  const error = await failure(i18nGuard(config)(root.e));
  assert.equal(error.status, 302);
  assert.equal(error.location, "/de?q=1");
  assert.equal(root.set.get("vary"), "cookie, accept-language, sec-fetch-site");
  const deep = event("/cart?x=1#h", { "accept-language": "fr, de;q=0.5" });
  const bounced = await failure(i18nGuard(config)(deep.e));
  assert.equal(bounced.status, 302);
  assert.equal(bounced.location, "/de/cart?x=1");
  const cookie = event("/cart", { cookie: "rivet_locale=de" });
  assert.equal((await failure(i18nGuard(config)(cookie.e))).location, "/de/cart");
});

test("guard: unprefixed URLs serve the default locale when it is preferred or chosen", async () => {
  const english = event("/cart", { "accept-language": "en" });
  assert.equal(await i18nGuard(config)(english.e), undefined);
  assert.equal(english.e.locals.locale, "en");
  assert.equal(english.set.get("vary"), "cookie, accept-language, sec-fetch-site");
  // Explicit choice: the cookie names the default locale.
  const chosen = event("/cart", { cookie: "rivet_locale=en", "accept-language": "de" });
  assert.equal(await i18nGuard(config)(chosen.e), undefined);
  assert.equal(chosen.e.locals.locale, "en");
  // Explicit choice: an unprefixed link followed on this site (e.g. a switcher to the default locale).
  for (const path of ["/cart", "/"]) {
    const clicked = event(path, { "accept-language": "de", "sec-fetch-site": "same-origin" });
    assert.equal(await i18nGuard(config)(clicked.e), undefined);
    assert.equal(clicked.e.locals.locale, "en");
  }
});

test("guard: prefixed URLs never redirect (no loops)", async () => {
  const { e, set } = event("/de/cart", { cookie: "rivet_locale=en", "accept-language": "en" }, { lang: "de" });
  assert.equal(await i18nGuard(config)(e), undefined);
  assert.equal(e.locals.locale, "de");
  assert.equal(set.has("vary"), false);
  const always = { ...config, routing: { prefix: "always" as const } };
  const en = event("/en/cart", { "accept-language": "de" }, { lang: "en" });
  assert.equal(await i18nGuard(always)(en.e), undefined);
  assert.equal(en.e.locals.locale, "en");
});

test("guard: always-prefixed routing redirects every unprefixed URL", async () => {
  const always = { ...config, routing: { prefix: "always" as const } };
  const variants: Record<string, string>[] = [{}, { "sec-fetch-site": "same-origin" }, { cookie: "rivet_locale=en" }];
  for (const headers of variants) {
    const { e } = event("/cart?x=1", headers);
    const error = await failure(i18nGuard(always)(e));
    assert.equal(error.status, 302);
    assert.equal(error.location, "/en/cart?x=1");
  }
  const german = event("/cart", { "accept-language": "de" });
  assert.equal((await failure(i18nGuard(always)(german.e))).location, "/de/cart");
  const mapped = { ...config, routing: { prefix: { en: "/us", de: "/deutsch" } } };
  const us = event("/", {});
  assert.equal((await failure(i18nGuard(mapped)(us.e))).location, "/us");
});

test("prefix never: locale from cookie/header, response varies", async () => {
  const { e, set } = event("/cart", { "accept-language": "de" });
  await i18nGuard({ ...config, routing: { prefix: "never" } })(e);
  assert.equal(e.locals.locale, "de");
  assert.equal(set.get("vary"), "cookie, accept-language");
});

test("alternates", () => {
  const links = alternates(new URL("https://x.test/de/cart"), config);
  assert.deepEqual(
    links.map((l) => [l.rel, l.hreflang, l.href]),
    [
      ["alternate", "en", "https://x.test/cart"],
      ["alternate", "de", "https://x.test/de/cart"],
      ["alternate", "x-default", "https://x.test/cart"],
      ["canonical", undefined, "https://x.test/de/cart"],
    ],
  );
  assert.throws(() => alternates(new URL("https://x.test/"), { ...config, baseUrl: undefined }), /baseUrl/);
});

test("dir", () => {
  assert.equal(dirOf("ar-EG"), "rtl");
  assert.equal(dirOf("de"), "ltr");
  assert.equal(dirOf("ku", ["ku"]), "rtl");
});

test("errorLocale: URL prefix, then cookie and Accept-Language (for createApp i18n.resolve)", async () => {
  const resolve = errorLocale(config);
  assert.equal(await resolve(new Request("https://x.test/de/nope")), "de");
  assert.equal(await resolve(new Request("https://x.test/nope", { headers: { cookie: "rivet_locale=de" } })), "de");
  assert.equal(await resolve(new Request("https://x.test/nope", { headers: { "accept-language": "de-CH" } })), "de");
  assert.equal(await resolve(new Request("https://x.test/nope")), "en");
  const mapped = errorLocale({ ...config, routing: { prefix: { en: "/us", de: "/deutsch" } } });
  assert.equal(await mapped(new Request("https://x.test/deutsch/nope")), "de");
});

const session = { path: "/", sameSite: "lax", httpOnly: false, secure: true };

test("locale cookie: a followed link to a prefixed URL records its locale", async () => {
  const { e, cookies } = event("/de/cart", { ...clicked, "accept-language": "en" }, { lang: "de" });
  await i18nGuard(config)(e);
  assert.equal(e.locals.locale, "de");
  assert.deepEqual(cookies, [["rivet_locale", "de", session]]);
  // Overrides a cookie naming another locale.
  const back = event("/de/cart", { ...clicked, cookie: "rivet_locale=en" }, { lang: "de" });
  await i18nGuard(config)(back.e);
  assert.deepEqual(back.cookies, [["rivet_locale", "de", session]]);
});

test("locale cookie: a followed unprefixed link (switcher to the default locale) records the default", async () => {
  for (const headers of [{ "accept-language": "de" }, { cookie: "rivet_locale=de" }] as Record<string, string>[]) {
    const { e, cookies } = event("/cart", { ...clicked, ...headers });
    assert.equal(await i18nGuard(config)(e), undefined);
    assert.equal(e.locals.locale, "en");
    assert.deepEqual(cookies, [["rivet_locale", "en", session]]);
  }
});

test("locale cookie: name and maxAge from the config, Secure only on https", async () => {
  const named = { ...config, cookie: { name: "lang", maxAge: 31536000 } };
  const { e, cookies } = event("/de", clicked, { lang: "de" }, "http://localhost:3000");
  await i18nGuard(named)(e);
  assert.deepEqual(cookies, [["lang", "de", { path: "/", sameSite: "lax", httpOnly: false, secure: false, maxAge: 31536000 }]]);
  // The configured name is the one read back: no rewrite.
  const again = event("/de", { ...clicked, cookie: "lang=de; rivet_locale=en" }, { lang: "de" });
  await i18nGuard(named)(again.e);
  assert.deepEqual(again.cookies, []);
});

test("locale cookie: not written from detection, unchanged values, other requests or when off", async () => {
  const quiet: [string, Record<string, string>, Record<string, string>, I18nRouteConfig?][] = [
    // Accept-Language picked the locale the URL names: detection, not a choice.
    ["/de/cart", { ...clicked, "accept-language": "de-CH" }, { lang: "de" }],
    ["/cart", { ...clicked, "accept-language": "en" }, {}],
    ["/cart", clicked, {}],
    // The cookie already names it.
    ["/de/cart", { ...clicked, cookie: "rivet_locale=de" }, { lang: "de" }],
    ["/cart", { ...clicked, cookie: "rivet_locale=en", "accept-language": "de" }, {}],
    // Not a followed link: typed URL / external link, prefetch, client-router data request.
    ["/de/cart", { "accept-language": "en" }, { lang: "de" }],
    ["/de/cart", { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }, { lang: "de" }],
    ["/de/cart", { ...clicked, "sec-purpose": "prefetch" }, { lang: "de" }],
    ["/de/cart", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors" }, { lang: "de" }],
    ["/cart", { "sec-fetch-site": "same-origin", "sec-fetch-mode": "cors", "accept-language": "de" }, {}],
    // Cookie off, or not a strategy.
    ["/de/cart", clicked, { lang: "de" }, { ...config, cookie: false }],
    ["/de/cart", clicked, { lang: "de" }, { ...config, strategy: ["url", "preferredLanguage", "baseLocale"] }],
    ["/cart", { ...clicked, "accept-language": "de" }, {}, { ...config, cookie: false }],
  ];
  for (const [path, headers, params, routeConfig = config] of quiet) {
    const { e, cookies } = event(path, headers, params);
    await i18nGuard(routeConfig)(e);
    assert.deepEqual(cookies, [], `${path} ${JSON.stringify(headers)}`);
  }
  // A redirect is not a choice either (the browser lands on the prefixed URL).
  const bounced = event("/cart", { "accept-language": "de" });
  await failure(i18nGuard(config)(bounced.e));
  assert.deepEqual(bounced.cookies, []);
});

test("locale cookie: always-prefixed routing records followed prefixed links only", async () => {
  const always = { ...config, routing: { prefix: "always" as const } };
  const en = event("/en/cart", { ...clicked, "accept-language": "de" }, { lang: "en" });
  await i18nGuard(always)(en.e);
  assert.deepEqual(en.cookies, [["rivet_locale", "en", session]]);
  const bare = event("/cart", { ...clicked, "accept-language": "de" });
  await failure(i18nGuard(always)(bare.e));
  assert.deepEqual(bare.cookies, []);
});

test("localeCookie: document.cookie string with the server's attributes", () => {
  assert.equal(localeCookie("de", config, true), "rivet_locale=de; Path=/; SameSite=Lax; Secure");
  assert.equal(localeCookie("de-AT", { ...config, cookie: { name: "lang", maxAge: 86400.5 } }, false), "lang=de-AT; Path=/; Max-Age=86400; SameSite=Lax");
  assert.equal(localeCookie("de", { ...config, cookie: false }, true), undefined);
});

test("setLocale: writes the cookie, then loads the page in the locale", () => {
  const g = globalThis as Record<string, unknown>;
  const assigned: string[] = [];
  const doc = { cookie: "" };
  g.location = { protocol: "https:", pathname: "/de/cart", search: "?x=1", hash: "#h", assign: (href: string) => assigned.push(href) };
  g.document = doc;
  try {
    setLocale("en", { ...config, cookie: { maxAge: 60 } });
    assert.equal(doc.cookie, "rivet_locale=en; Path=/; Max-Age=60; SameSite=Lax; Secure");
    assert.deepEqual(assigned, ["/cart?x=1#h"]);
    doc.cookie = "";
    setLocale("de", { ...config, cookie: false });
    assert.equal(doc.cookie, "");
    assert.deepEqual(assigned, ["/cart?x=1#h", "/de/cart?x=1#h"]);
  } finally {
    delete g.location;
    delete g.document;
  }
});
