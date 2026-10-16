---
title: Locale URLs
description: Put the language in the URL with a [[lang]] route segment and i18nGuard, link between languages, and add hreflang tags for search engines.
template: guide
status: experimental
related: [guides/i18n/translating-text, guides/routing/guards, guides/routing/params, guides/routing/head-and-seo]
---

Each language of your site needs its own URLs, for example `/about` in English and `/de/about` in German. Search engines can then index every language, and people can share a link in their language. `@rivetjs/i18n/router` connects the language to [file routes](../routing/file-routes.md).

After reading this page you can add a language prefix to your routes, choose the language for each request, build links to other languages and add `hreflang` tags.

::example{id=i18n-plurals}

## Choose a URL style

Set `routing.prefix` in your i18n config:

| `prefix` | English URL | German URL |
| --- | --- | --- |
| `"as-needed"` (default) | `/about` | `/de/about` |
| `"always"` | `/en/about` | `/de/about` |
| `"never"` | `/about` | `/about` (language from cookie or browser) |
| `{ en: "us", de: "deutsch" }` | `/us/about` | `/deutsch/about` |

```ts title="i18n.config.ts"
import type { I18nRouteConfig } from "@rivetjs/i18n/router";

export const config = {
  locales: ["en", "de"],
  defaultLocale: "en",
  catalogs: "locales/{locale}.json",
  routing: { prefix: "as-needed" },
  baseUrl: "https://shop.example.com",
} satisfies I18nRouteConfig & { catalogs: string };
```

## Add the language segment

Put your pages in a folder named `[[lang]]`. Double brackets make the segment optional, so `/` and `/de` both match:

```txt
src/routes/
  [[lang]]/
    _layout.tsx
    index.tsx
    about.tsx
```

Export `i18nGuard` as the [guard](../routing/guards.md) (`serverGuard`) of the folder's layout. A layout guard runs for every page in the folder:

```tsx title="src/routes/[[lang]]/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";
import { i18nGuard } from "@rivetjs/i18n/router";
import { config } from "../../../i18n.config.ts";

export const serverGuard = i18nGuard(config);

export default function LangLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
```

What the guard does on each request:

- If the URL has a `lang` segment, it must name one of your locales. Otherwise the response is a 404.
- If the URL has no segment, the guard finds the best language. When that language has a prefix, the URL redirects (302) to it, for example `/cart` to `/de/cart` (the query stays). With `"as-needed"`, a cookie that names the default language and a link followed on your own site are choices: the guard shows the default language and does not redirect. With `"always"` or a prefix map, every URL without a prefix redirects.
- URLs with a prefix never redirect.
- It sets `locals.locale`, `locals.dir` (`"ltr"` or `"rtl"`) and the `Content-Language` header.
- When a cookie or the browser's language decided, it adds `Vary: cookie, accept-language` (with `"as-needed"` also `sec-fetch-site`), so caches keep the versions apart.
- When a visitor picks a language, it remembers the choice in the locale cookie (see below).

## How the language is chosen

Without a language in the URL, the guard tries these sources in order and takes the first one that is in `locales`:

1. `url`: the path prefix.
2. `cookie`: the `rivet_locale` cookie. Change the name with `cookie: { name: "lang" }`, or turn it off with `cookie: false`.
3. `preferredLanguage`: the browser's `Accept-Language` header. `de-CH` matches `de`, and `de` matches `de-AT`.
4. `baseLocale`: the default language.

Change the order with `strategy`, for example `strategy: ["url", "preferredLanguage", "baseLocale"]`. You can also add your own strategy object `{ name, server(request, source) }` that returns a locale or `undefined`.

### Remember the visitor's choice

The guard sets the locale cookie when a visitor picks a language: they follow a link on your site to a URL in another language than the one the cookie or the browser would pick. With `"as-needed"`, a link to a URL without a prefix picks the default language. On the next visit, the cookie decides, even when the browser prefers another language.

The guard does not set the cookie:

- when only the browser's language decided (no choice was made),
- when the cookie already names that language,
- for typed URLs, bookmarks and links from other sites, which do not send `Sec-Fetch-Site: same-origin`,
- for prefetch requests and client router data requests.

The cookie is `rivet_locale=<locale>; Path=/; SameSite=Lax`, plus `Secure` on https. It is a session cookie unless you set `maxAge` (seconds):

```ts title="i18n.config.ts"
cookie: { name: "lang", maxAge: 60 * 60 * 24 * 365 },
```

Scripts can read it (no `HttpOnly`). The response that sets it is `Cache-Control: private`, so a CDN cannot hand one visitor's choice to everyone; all other responses keep the caching you set. If the browser blocks cookies, a link to the default language still works for that page, but the next visit picks the language from the browser again.

## Set lang and dir on the page

The document shell receives `locale` and `dir`. Use them on `<html>`, so screen readers and the browser know the language:

```ts title="src/document.ts"
import { headTags, type DocumentShell } from "@rivetjs/router/server";

const document: DocumentShell = ({ head, styles, locale, dir }) => ({
  start:
    `<!doctype html><html lang="${locale ?? "en"}" dir="${dir ?? "ltr"}"><head><meta charset="utf-8">` +
    headTags(head ?? {}) +
    styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("") +
    "</head><body>",
  end: "</body></html>",
});
export default document;
```

`dirOf(locale)` returns `"rtl"` for Arabic, Persian, Hebrew, Urdu and a few others. Pass `rtl: [...]` in the config to change the list.

## Link to another language

`localizeHref(href, locale, config)` swaps the language prefix of a URL. `delocalizeHref(href, config)` removes it. Query and hash stay.

```tsx title="src/routes/[[lang]]/about.tsx"
import type { PageProps } from "@rivetjs/router";
import { localizeHref } from "@rivetjs/i18n/router";
import { config } from "../../../i18n.config.ts";

export default function About({ url }: PageProps) {
  return (
    <nav>
      <a href={localizeHref(url.pathname, "en", config)} hreflang="en">English</a>
      <a href={localizeHref(url.pathname, "de", config)} hreflang="de">Deutsch</a>
    </nav>
  );
}
```

With `prefix: "as-needed"`, `localizeHref("/de/about", "en", config)` is `/about` and `localizeHref("/about", "de", config)` is `/de/about`. If the app is served under a base path (`rivetRouter({ base: "/shop" })`), the language prefix comes after it: `localizeHref("/shop/about", "de", config)` is `/shop/de/about`. Switching the language is a normal page navigation: a link to a URL of another language always loads the whole page, also with the client router and in the dev server, so the new page runs the browser code of its language and the guard remembers the choice. No `data-rivet-reload` is needed.

To switch from code, for example from a `<select>`, call `setLocale(locale, config)`. It writes the locale cookie with the same attributes as the guard and loads the current page in that language:

```tsx
import { setLocale } from "@rivetjs/i18n/router";

<select onChange={(e) => setLocale(e.currentTarget.value, config)}>…</select>
```

## Tell search engines about other languages

`alternates(url, config)` returns `<link>` entries for the route's `head` export: one `hreflang` link per language, an `x-default` link to the default language and a `canonical` link. It needs `baseUrl` in the config.

```tsx title="src/routes/[[lang]]/index.tsx"
import { alternates } from "@rivetjs/i18n/router";
import { config } from "../../../i18n.config.ts";

export const head = ({ url }: { url: URL }) => ({ title: "Shop", links: alternates(url, config) });
```

See [Head and SEO](../routing/head-and-seo.md) for more about `head`.

## Error pages in the right language

An unmatched URL has no guard that settled the language. By default `_404` then takes the language of the URL prefix (`/de/nope` renders in German), and otherwise the first locale (`/nope`). To also use the cookie and `Accept-Language` for URLs without a prefix, pass `errorLocale(config)` to the Node adapter. It resolves the language like the guard: URL prefix, cookie, then `Accept-Language`:

```ts title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";
import { errorLocale } from "@rivetjs/i18n/router";
import { config } from "./i18n.config.ts";

const serving = await start({ dist: "dist", locales: ["en", "de"], resolveLocale: errorLocale(config) });
closeOnSignals(serving);
```

`loadBuild(dist, config, { locales, resolveLocale })` takes the same option. The dev server uses the URL prefix, as the default does.

## Common mistakes

- **404 for a valid page.** The first segment looked like a language but is not in `locales`, or a page outside `[[lang]]` has the same path. Keep translated pages inside `[[lang]]`.
- **`alternates() needs baseUrl`.** Add `baseUrl` (your public origin) to the config.
- **Wrong language from a CDN cache.** Keep the `Vary` header the guard sets, or cache only prefixed URLs.
- **`/de` missing from a static build.** Prerendering only follows `serverEntries`. Export `serverEntries = () => [{ lang: "de" }]` from the `[[lang]]` page and pass `locales` to `prerenderBuild`.

## See also

- [Translating text](translating-text.md)
- [Guards](../routing/guards.md)
- [Params](../routing/params.md)
