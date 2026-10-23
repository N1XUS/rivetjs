// createApp with i18n: the guard's `locals.locale` picks the compiled variant, the locale's resume
// manifest and the document's `lang`/`dir`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { _variants, _variantTemplate, _variantValue } from "@rivetjs/runtime/server";
import type { ResumeManifest } from "@rivetjs/runtime/server-resume";
import { _rB, _rBEnd, _rBOut, _rSig } from "@rivetjs/runtime/server-derived";
import { createApp, mergeHeads, type GeneratedEntry } from "../server/app.ts";
import type { DocumentInput } from "../server/render.ts";
import type { ServerModule } from "../server/handler.ts";
import { notFound } from "../shared/errors.ts";
import { i18nGuard, type I18nRouteConfig } from "@rivetjs/i18n/router";

const fragments = _variants([
  ["<p>Hello ", "</p>"],
  ["<p>Hallo ", "</p>"],
]);
const manifest = (locale: string): ResumeManifest => ({
  runtime: `/${locale}/assets/resume-entry.js`,
  symbols: { Page: `/${locale}/assets/page.js` },
});

function app(guard: ServerModule["guard"]) {
  const inputs: DocumentInput[] = [];
  const entry: GeneratedEntry = {
    routes: [{ id: "index", pattern: "/", layouts: [], server: () => Promise.resolve({ guard }), page: true }],
    universal: {},
    page: () => () => {
      const B = _rB("Page", 0);
      try {
        const n = _rSig("n", 1);
        return _rBOut(B, _variantTemplate(fragments, [() => _variantValue(["en" + n(), () => "de" + n()])]));
      } finally {
        _rBEnd(B);
      }
    },
  };
  const handler = createApp({
    entry,
    manifest: manifest("en"),
    document: (input) => {
      inputs.push(input);
      return { start: `<html lang="${input.locale ?? "-"}" dir="${input.dir ?? "-"}"><body>`, end: "</body></html>" };
    },
    i18n: { locales: ["en", "de"], manifests: { en: manifest("en"), de: manifest("de") } },
  });
  return { inputs, get: async () => (await handler(new Request("https://x.test/"), { nonce: "n" })).text() };
}

test("locals.locale selects variant, manifest and document lang/dir", async () => {
  const { inputs, get } = app((event) => {
    event.locals.locale = "de";
    event.locals.dir = "rtl";
  });
  const html = await get();
  assert.match(html, /^<html lang="de" dir="rtl"><body><!--b1--><p>Hallo de1<\/p>/);
  assert.match(html, /\/de\/assets\/page\.js/);
  assert.doesNotMatch(html, /\/en\/assets\//);
  assert.equal(inputs[0]!.locale, "de");
});

test("mergeHeads keeps hreflang alternates that share an href", () => {
  const links = [
    { rel: "alternate", hreflang: "en", href: "https://x.test/" },
    { rel: "alternate", hreflang: "x-default", href: "https://x.test/" },
  ];
  assert.deepEqual(mergeHeads([{ links }])?.links, links);
});

test("without a known locale the first locale renders and the document gets no lang", async () => {
  for (const locale of [undefined, "fr"]) {
    const { get } = app((event) => {
      if (locale) event.locals.locale = locale;
    });
    const html = await get();
    assert.match(html, /^<html lang="-" dir="-"><body><!--b1--><p>Hello en1<\/p>/);
    assert.match(html, /\/en\/assets\/page\.js/);
    assert.doesNotMatch(html, /\/de\/assets\//);
  }
});

test("dev: devScripts as a function get the page's locale", async () => {
  const seen: (string | undefined)[] = [];
  const entry: GeneratedEntry = {
    routes: [
      {
        id: "index",
        pattern: "/[lang]",
        layouts: [],
        server: () => Promise.resolve({ guard: (event) => void (event.locals.locale = event.params.lang) }),
        page: true,
      },
    ],
    universal: {},
    page: () => () => _variantTemplate(fragments, ["x"]),
  };
  const handler = createApp({
    entry,
    dev: true,
    document: (input) => ({ start: `<html lang="${input.locale ?? "-"}"><body>`, end: "</body></html>" }),
    devScripts: (locale) => (seen.push(locale), ["/entry.dev.tsx" + (locale === "de" ? "?rivet-locale=de" : "")]),
    i18n: { locales: ["en", "de"] },
  });
  const html = await (await handler(new Request("https://x.test/de"), { nonce: "n" })).text();
  assert.match(html, /^<html lang="de"><body><div data-rivet-dev[^>]*><p>Hallo x<\/p>/);
  assert.match(html, /<script type="module" src="\/entry\.dev\.tsx\?rivet-locale=de" nonce="n">/);
  await handler(new Request("https://x.test/en"), { nonce: "n" });
  assert.deepEqual(seen, ["de", "en"]);
});

function errorApp(resolve?: (request: Request) => string | undefined | Promise<string | undefined>) {
  const entry: GeneratedEntry = {
    routes: [
      {
        id: "page",
        pattern: "/[lang]/x",
        layouts: [],
        server: () =>
          Promise.resolve({
            guard: (event) => {
              event.locals.locale = event.params.lang;
            },
            load: () => {
              throw notFound();
            },
          }),
        page: true,
      },
    ],
    universal: {},
    page: (input) => () => _variantTemplate(fragments, [String(input.error?.status)]),
  };
  const handler = createApp({
    entry,
    manifest: manifest("en"),
    document: (input) => ({ start: `<html lang="${input.locale ?? "-"}"><body>`, end: "</body></html>" }),
    i18n: { locales: ["en", "de"], manifests: { en: manifest("en"), de: manifest("de") }, ...(resolve ? { resolve } : {}) },
  });
  return async (path: string, headers: Record<string, string> = {}) => {
    const response = await handler(new Request("https://x.test" + path, { headers }), { nonce: "n" });
    return { status: response.status, html: await response.text() };
  };
}

test("error pages render the locale the guard resolved", async () => {
  const { status, html } = await errorApp()("/de/x");
  assert.equal(status, 404);
  assert.match(html, /^<html lang="de"><body><p>Hallo 404<\/p>/);
});

test("unmatched URLs: error page locale from i18n.resolve, else the URL's locale prefix", async () => {
  const byHeader = errorApp((request) => (request.headers.get("accept-language") === "de" ? "de" : undefined));
  assert.match((await byHeader("/nope", { "accept-language": "de" })).html, /^<html lang="de"><body><p>Hallo 404<\/p>/);
  assert.match((await byHeader("/nope")).html, /^<html lang="-"><body><p>Hello 404<\/p>/);
  // Resolver results outside `locales` are ignored.
  assert.match((await errorApp(() => "fr")("/nope")).html, /^<html lang="-"><body><p>Hello 404<\/p>/);
  assert.match((await errorApp()("/de/nope/deeper")).html, /^<html lang="de"><body><p>Hallo 404<\/p>/);
  assert.match((await errorApp()("/DE/nope")).html, /^<html lang="de"><body><p>Hallo 404<\/p>/);
  assert.match((await errorApp()("/zz/nope")).html, /^<html lang="-"><body><p>Hello 404<\/p>/);
});

// The real guard through createApp: the locale cookie it writes is a real `Set-Cookie`.
function guardedApp(config: I18nRouteConfig, headers?: ServerModule["headers"]) {
  const guard = i18nGuard(config);
  const server = () => Promise.resolve({ guard, headers });
  const entry: GeneratedEntry = {
    routes: [
      { id: "[[lang]]/cart", pattern: "/cart", layouts: [], server, page: true },
      { id: "[[lang]]/cart", pattern: "/:lang/cart", layouts: [], server, page: true },
    ],
    universal: {},
    page: () => () => _variantTemplate(fragments, ["cart"]),
  };
  const handler = createApp({
    entry,
    manifest: manifest("en"),
    document: (input) => ({ start: `<html lang="${input.locale ?? "-"}"><body>`, end: "</body></html>" }),
    i18n: { locales: ["en", "de"], manifests: { en: manifest("en"), de: manifest("de") } },
  });
  return async (url: string, headers: Record<string, string> = {}) => {
    const response = await handler(new Request(url, { headers }), { nonce: "n" });
    return { response, html: await response.text() };
  };
}
const i18nConfig: I18nRouteConfig = { locales: ["en", "de"], defaultLocale: "en", routing: { prefix: "as-needed" } };
const followed = { "sec-fetch-site": "same-origin", "sec-fetch-mode": "navigate" };

test("as-needed: a switcher link to the default locale sticks across a later visit without Sec-Fetch-Site", async () => {
  const get = guardedApp({ ...i18nConfig, cookie: { maxAge: 31536000 } });
  // A German browser lands on the German page.
  const landed = await get("https://x.test/cart", { "accept-language": "de" });
  assert.equal(landed.response.status, 302);
  assert.equal(landed.response.headers.get("location"), "/de/cart");
  assert.equal(landed.response.headers.get("set-cookie"), null);
  // The switcher's plain link to English: served unprefixed, choice recorded.
  const switched = await get("https://x.test/cart", { ...followed, "accept-language": "de", referer: "https://x.test/de/cart" });
  assert.equal(switched.response.status, 200);
  assert.match(switched.html, /^<html lang="en">/);
  const cookie = switched.response.headers.get("set-cookie");
  assert.equal(cookie, "rivet_locale=en; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
  // Later visit (typed URL, bookmark: no Sec-Fetch-Site) sends the cookie back: no bounce, no rewrite.
  const later = await get("https://x.test/cart", { cookie: cookie!.split(";")[0]!, "accept-language": "de" });
  assert.equal(later.response.status, 200);
  assert.match(later.html, /^<html lang="en">/);
  assert.equal(later.response.headers.get("set-cookie"), null);
  // Switching back to German records it; the next visit to an unprefixed URL goes to German.
  const german = await get("https://x.test/de/cart", { ...followed, cookie: "rivet_locale=en", "accept-language": "de" });
  assert.match(german.html, /^<html lang="de">/);
  assert.equal(german.response.headers.get("set-cookie"), "rivet_locale=de; Path=/; Max-Age=31536000; Secure; SameSite=Lax");
  const back = await get("https://x.test/cart", { cookie: "rivet_locale=de" });
  assert.equal(back.response.status, 302);
  assert.equal(back.response.headers.get("location"), "/de/cart");
});

test("locale cookie over http: session cookie without Secure; none from Accept-Language alone", async () => {
  const get = guardedApp(i18nConfig);
  const switched = await get("http://localhost/cart", { ...followed, "accept-language": "de" });
  assert.equal(switched.response.headers.get("set-cookie"), "rivet_locale=en; Path=/; SameSite=Lax");
  const detected = await get("http://localhost/de/cart", { ...followed, "accept-language": "de" });
  assert.match(detected.html, /^<html lang="de">/);
  assert.equal(detected.response.headers.get("set-cookie"), null);
});

test("a response that writes the locale cookie is private; other responses keep their caching", async () => {
  const get = guardedApp(i18nConfig, () => ({ "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=30" }));
  const switched = await get("https://x.test/cart", { ...followed, "accept-language": "de" });
  assert.match(switched.response.headers.get("set-cookie") ?? "", /^rivet_locale=en;/);
  assert.equal(switched.response.headers.get("cache-control"), "private, max-age=60, stale-while-revalidate=30");
  const german = await get("https://x.test/de/cart", { ...followed, cookie: "rivet_locale=en" });
  assert.equal(german.response.headers.get("cache-control"), "private, max-age=60, stale-while-revalidate=30");
  // No cookie written: caching untouched, no Vary added to prefixed URLs.
  for (const [url, headers] of [
    ["https://x.test/de/cart", { ...followed, cookie: "rivet_locale=de" }],
    ["https://x.test/de/cart", {}],
    ["https://x.test/cart", { "accept-language": "en" }],
  ] as const) {
    const { response } = await get(url, headers);
    assert.equal(response.headers.get("set-cookie"), null);
    assert.equal(response.headers.get("cache-control"), "public, max-age=60, s-maxage=600, stale-while-revalidate=30");
  }
  assert.equal((await get("https://x.test/de/cart", followed)).response.headers.has("vary"), false);
  // Without a route Cache-Control: the default `no-cache`, made private.
  const plain = await guardedApp(i18nConfig)("https://x.test/cart", { ...followed, "accept-language": "de" });
  assert.equal(plain.response.headers.get("cache-control"), "private, no-cache");
});
