---
title: Instant page transitions
description: Let the browser fetch or prerender the next page while the pointer rests on a link, so full page loads appear almost at once.
template: recipe
related: [guides/routing/links-and-navigation, guides/performance/preloading, recipes/analytics-page-views, guides/security/csp]
---

## What you will build

Links that load a whole new document (a docs site, a blog, a page outside your app's routes) start that load before the click. When the pointer rests on a link, the browser fetches the next page. The click then shows a page that is already there.

The benefit depends on network latency, cache headers and how much of the next page arrives before the click. Measure click-to-paint with your production build.

## How it works

### 1. Turn it on

For the whole app, in `vite.config.ts`:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", prefetch: "document" })],
});
```

Every same-origin link that loads a document is now prefetched on intent. For one link only, set the `prefetch` prop instead. The router notices the prop in your sources and turns the feature on.

When the client router is active on the page (an interactive page, or every page with `clientRouter: true`; see [when the router is active](../guides/routing/links-and-navigation.md#when-the-router-is-active)), a link to one of your app's pages is handled by it, and it already loads the next page's data and code on hover. A link whose path matches none of your page routes (a page served by another app on the same origin, a static file, an endpoint) loads a whole document on click; the router finds these links itself, so they need no `reload`. Those links, and links you mark with `reload`, take `prefetch`:

```tsx
import { Link } from "@rivetjs/router/link";

<a href="/blog/" data-rivet-prefetch="document">Blog</a>;
<a href="/pricing/" data-rivet-prefetch="prerender">Pricing</a>;
<Link to="/guide/next" reload prefetch="prerender">Next chapter</Link>;
```

Here `/blog/` and `/pricing/` are served by another app on the origin. `/guide/next` is one of your pages: `reload` makes its click load a document.

A link opts out with `prefetch="none"`.

### 2. Which links take part

Only links whose click loads a document:

- In an app with more than one page, the client router handles links to its pages itself: it loads the next page's data and code on hover and swaps the page without a document load. Those links keep doing that, and the browser does not fetch their documents too. Links whose path matches no page route, and links with `reload` (`data-rivet-reload`) or `rel="external"`, load documents, so they take part. The page carries a pattern of your route paths for this, in the rules and in the fallback.
- In an app with a single page, there is no client router: every marked link takes part.

Skipped: links to other origins, the current page, `download` links, links with a `target` other than `_self`. Links to your endpoints load a document on click but are not prefetched (the route pattern includes them, so a download or a request with side effects never starts on hover); mark one `reload` to prefetch it.

### 3. `document` or `prerender`

| | `document` | `prerender` |
| --- | --- | --- |
| What loads early | The page's HTML only. | The whole page, rendered in a hidden tab: HTML, styles, scripts, images. |
| On click | The browser still parses and paints the page, usually a few milliseconds. | The hidden page is shown at once. |
| Cost of a wasted guess | One HTML request. | One HTML request plus everything the page loads and runs. |
| Use it for | Many links: menus, side navigation, lists. | The one or two links the user most likely clicks next, such as "Next page". |

The Rivet docs use `document` for the side navigation and links in the text, and `prerender` for the previous and next page links at the end of each page.

### 4. What the browser does

- **Chromium (Chrome, Edge).** Every page gets a `<script type="speculationrules">` with rules for the marked links, with `moderate` eagerness by default. The browser starts the fetch when the pointer rests on a link for about 200 ms, or on pointer down. `rivetRouter({ prefetchEagerness })` changes this (see Variations). It also limits how many pages it keeps, and drops unused ones after about five minutes. No JavaScript runs for this, and links added later are covered too.
- **Other browsers.** A small inline script (plus the route pattern) fetches the page when the pointer rests on a link for 65 ms (cancelled if it leaves earlier), when the link gets focus, or on touch or pointer down. It uses `<link rel="prefetch">` (Firefox) or `fetch()` with low priority (where `rel="prefetch"` is not supported). Each URL is fetched once. The first time, it checks that the page may be cached (see Cache headers). It does nothing when the visitor turned on Save-Data or is on a 2G connection.

The script has no imports and does not start the Rivet runtime, so it works on resumed pages as they are.

### 5. Cache headers

Chromium uses the prefetched page even when it is sent with `Cache-Control: no-cache`.

The fallback only fills the browser's HTTP cache. The click uses that copy only when the response may be reused without asking the server again. Send a short `max-age` on HTML pages, for example:

```txt
Cache-Control: public, max-age=60, stale-while-revalidate=300
```

With `no-cache` (the default of many static hosts) the click asks the server again, so a prefetch would not help. The fallback checks this once: its first request reads the page's `Cache-Control` and `Pragma` headers. When they say `no-store`, `no-cache`, or `max-age=0` without `stale-while-revalidate`, the fallback stops prefetching for the rest of the tab session (it stores the answer in `sessionStorage`). Otherwise it prefetches that page and every later one. Do not cache pages with personal data.

### 6. Server cost

Each prefetch is a full page request. A visitor who moves the pointer over ten links may cause ten requests, and `prerender` also loads each page's styles, scripts and images. Static files on a CDN make this cheap. For a server that renders each request:

- Chromium marks the requests: `Sec-Purpose: prefetch`, or `Sec-Purpose: prefetch;prerender`. Answer them like other requests, or with a `503` when the server is busy (the browser then loads the page on click as usual).
- Keep `prerender` for few links.

## Variations

- **Prerender everything.** `rivetRouter({ prefetch: "prerender" })` makes `prerender` the default. Chromium keeps only a few prerendered pages at once with `moderate` eagerness; this suits small sites.
- **Earlier or later.** `rivetRouter({ prefetchEagerness: "conservative" })` waits for pointer or touch down in Chromium: fewer wasted requests, a smaller head start. `"eager"` starts sooner than the default `"moderate"`; Chromium decides exactly when. The fallback keeps its own timing.

  ```ts
  import { rivetRouter } from "@rivetjs/router/vite";

  rivetRouter({ prefetch: "document", prefetchEagerness: "conservative" });
  ```

- **Reload links only.** In a client-routed app every page carries a pattern of all route paths, so links that no route matches load a document too. When every document link is a `reload` link (a docs site, for example), `rivetRouter({ prefetchPaths: false })` drops that pattern: only `reload` and `rel="external"` links are prefetched, and each page omits that route-pattern payload.

  ```ts
  import { rivetRouter } from "@rivetjs/router/vite";

  rivetRouter({ prefetch: "document", prefetchPaths: false });
  ```

- **Content Security Policy.** The rules and the fallback are inline scripts. Server pages get the response's nonce on both. Static builds with `prerenderBuild({ csp })` list both in the page's hash policy. Nothing else is needed.

## Watch out

- **Analytics and prerendering.** A prerendered page runs its scripts before the user sees it, and may never be shown. Count a page view only once the page is shown:

  ```ts
  import { whenActivated } from "@rivetjs/router/prefetch";

  whenActivated(() => sendPageView(location.pathname));
  ```

  `whenActivated(fn)` runs `fn` at once, or, on a page that is being prerendered (`document.prerendering`), on its `prerenderingchange` event. The router's own `onNavigate` and `rivet:navigate` fire only for client navigations, so they never fire in a hidden prerendered page. See the [analytics page views](./analytics-page-views.md) recipe.
- **Side effects on load.** Code that runs when a page loads (an effect that marks a message read, a counter) also runs for prerendered pages. Use `whenActivated` there too, or use `document` instead of `prerender`.
- **One URL, two kinds of links.** Chromium starts the prefetch for a URL when the pointer rests on any link to that URL. A client-routed link to the same URL as a `reload` link also starts it.
- **Support detection.** A browser that reports speculation-rules support does not get the script fallback. Check actual document requests in the browsers you support.
