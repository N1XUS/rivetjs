---
title: Kit
description: Set the title, meta tags, links, scripts, JSON-LD, fonts and image preloads from any component with @rivetjs/kit, under a strict CSP, and draw lucide icons.
template: guide
status: experimental
related: [guides/routing/head-and-seo, guides/security/csp, guides/security/trusted-types, guides/assets/images, guides/styling/scoped-styles]
---

`@rivetjs/kit` lets components write into the page's `<head>`. You can set the title, meta tags, links, third-party scripts, JSON-LD, font preloads and image preloads from the component that knows the values, not only from the route's `head` export. After reading this page you can set up the kit, use its head components, and know which value wins when two components set the same tag.

The kit is experimental and works only with the file router (`@rivetjs/router`) for now.

## Set up the kit

Add the `kit()` Vite plugin next to `rivetRouter()`:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { kit } from "@rivetjs/kit/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [kit(), rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

With `kit()` installed, the router waits until the page has rendered before it writes `<head>`. This way it knows every head tag your components set. Synchronous pages are still sent in one write. To keep the old behaviour (route `head` exports only, head written first), set `rivetRouter({ head: "early" })`.

Then pass the whole document input to `headTags` in your document shell. It writes the stylesheets, the CSP nonce and marks on tags that the browser updates later. Do not add your own `<link rel="stylesheet">` loop as well, or each sheet is linked twice:

```ts title="src/document.ts"
import type { DocumentShell } from "@rivetjs/router/server";
import { bodyAttributes, headTags, htmlAttributes } from "@rivetjs/router/head";

const document: DocumentShell = (input) => ({
  start:
    `<!doctype html><html${htmlAttributes(input.head, { lang: "en" })}><head><meta charset="utf-8">` +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags(input.head, input) +
    `</head><body${bodyAttributes(input.head)}>`,
  end: "</body></html>",
});
export default document;
```

If a head component renders without the router set up this way, it throws an error that names the missing setup.

## Head components

```tsx title="src/routes/products/[id].tsx"
import { HeadLink, JsonLd, Meta, Title } from "@rivetjs/kit";

export default function Product({ data }: { data: { name: string; summary: string } }) {
  return (
    <article>
      <Title>{data.name}</Title>
      <Meta name="description" content={data.summary} />
      <HeadLink rel="icon" href="/icon.svg" type="image/svg+xml" />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Product", name: data.name }} />
      <h1>{data.name}</h1>
    </article>
  );
}
```

These components render nothing where you place them. Their values go into the page head.

| Component | Writes |
| --- | --- |
| `<Title>` | `<title>`. The children are joined into one string. |
| `<Meta>` | `<meta>`: `name`, `property`, `httpEquiv` or `itemprop`, plus `content` and optional `media`. |
| `<HeadLink>` | `<link>`: `rel`, `href`, and `type`, `hreflang`, `media`, `sizes`, `as`, `crossorigin`, `imagesrcset`, `imagesizes`, `fetchpriority` and more. |
| `<Script>` | A script file with a load strategy, or reviewed inline code. See below. |
| `<JsonLd>` | `<script type="application/ld+json">`. The `<` character is escaped. |
| `<Head value={…}>` | Any head fields at once, for example the result of `seo()`. |
| `<ThemeScript>` | A small blocking script that sets the stored theme on `<html>` before the first paint, so dark mode does not flash. |

The link component is called `HeadLink` because `Link` is the router's navigation component.

Resumed pages never run components in the browser, so static head tags cost no JavaScript there. After client navigation, the kit updates the title, meta tags, links and JSON-LD for the new page.

### Title template

Add `titleTemplate` to a route `head` export, usually in the root layout. `%s` is replaced by the winning title, once:

```tsx title="src/routes/_layout.tsx"
export const head = { titleTemplate: "%s | Shop" };
```

A page with `<Title>Boots</Title>` then gets `<title>Boots | Shop</title>`.

## SEO in one call

`seo()` builds the description, canonical link, Open Graph and Twitter tags from one object:

```tsx
import { Head, seo } from "@rivetjs/kit";

<Head
  value={seo({
    title: "Boots",
    description: "Waterproof boots for long walks.",
    url: "https://shop.example/boots",
    image: "https://shop.example/boots.jpg",
  })}
/>;
```

The smaller builders are `canonical()`, `alternates()` (hreflang links), `openGraph()`, `twitterCard()` and `jsonLd()`. They return plain head fields, so you can also use them in a route `head` export.

Social and SEO URLs must be absolute. A relative URL throws an error unless you pass `baseUrl`.

::api{symbol="@rivetjs/kit#seo"}

## Which value wins

Several layouts, the page and its components can set the same tag. The rules, in plain words:

- **The deeper level wins.** The page beats its layouts, and an inner layout beats an outer one.
- **On the same level, components win** over the route's `head` export.
- **Otherwise the later one wins.**

"The same tag" means the same key:

- Meta tags: same `name`, `property`, `httpEquiv` or `itemprop` (and `media`).
- Links: only one `canonical`; alternates by `hreflang`; icons by `sizes` and `media`; other links by `rel` and `href`.
- Scripts: same `id`, otherwise same `src`.
- JSON-LD: only by `id`. Blocks without an `id` are all kept.

Give any entry a `key` to choose the key yourself.

In the browser after client navigation, the rule is close but simpler: layout components rank below the route `head` export, and page components win.

:::note
Head components inside a streamed `Async` part render after `<head>` was sent. Links and scripts still render in place there. Title and meta changes are ignored, with a warning.
:::

## Scripts with load strategies

```tsx
import { Script } from "@rivetjs/kit";

<Script src="https://analytics.example/a.js" strategy="idle" />;
```

| `strategy` | When the script loads |
| --- | --- |
| `blocking` | While the page is parsed (`<script src>`). |
| `eager` | As soon as possible (`<script async>`). |
| `defer` (default) | After parsing (`<script defer>`). |
| `body` | At the end of `<body>`, after the page's markup (the shell writes it with `bodyTags`). Inline scripts too. |
| `load` | After the page's `load` event. |
| `idle` | When the browser is idle after load (at most 4 seconds later). |
| `interaction` | On the first pointer, key or wheel input. |

`load`, `idle` and `interaction` use one small inline script per page (under 400 bytes gzipped), added only to pages that need it. In the browser, `loadScript(src)` loads a script file once.

Inline code needs `unsafeInlineScript(code)`. Plain strings and objects are refused. The name is a warning: only pass code you have reviewed, because it runs with the page's CSP permission.

```tsx
import { Script, unsafeInlineScript } from "@rivetjs/kit";

<Script inline={unsafeInlineScript("window.dataLayer = window.dataLayer || [];")} strategy="blocking" />;
```

An inline script with `strategy="body"` runs once the elements above it exist, for example to wire up an `<iframe>` the page rendered: `<Script inline={unsafeInlineScript(code)} strategy="body" />`. Client navigation does not run inline scripts again; use a component's event handlers for code that must run on every page.

## Fonts

Import a self-hosted font file with `&font` at the end of the query, and add `<Font>` with `preload` where it is used:

```tsx title="src/routes/_layout.tsx"
/// <reference types="@rivetjs/kit/client" />
import { Font } from "@rivetjs/kit/font";
import inter from "../fonts/Inter.woff2?weight=100..900&fallback=Arial&font";

// inter.stack is the font-family value: "Inter", its fallback, sans-serif.
<Font font={inter} preload />;
```

- Query parameters: `family` (default: file name), `weight` (`400` or a range `100..900`), `style`, `display` (default `swap`, or `kit({ fonts: { display } })`), `fallback`, `unicodeRange`.
- The `@font-face` rule goes into the CSS of the route that imports the font. The preload and the CSS use the same file.
- A `fallback` font with adjusted size and line metrics needs the optional packages `@capsizecss/unpack` (3.x or 4.x) and `@capsizecss/metrics`. Without them you get a warning and no adjusted fallback. For a variable font (a `weight` range) the metrics of the family's regular weight are used when `@capsizecss/metrics` knows the family, otherwise those of the file's default instance.

### Google Fonts

Import a Google font with a `google-font:` id. The build downloads it once and serves it from your own site, so pages never request anything from Google:

```tsx title="src/routes/_layout.tsx"
import { Font } from "@rivetjs/kit/font";
import inter from "google-font:Inter?weight=100..900&fallback=Arial&font";

<Font font={inter} preload />;
```

- Query parameters: `weight`, `style` (`normal` or `italic`), `subset` (default `latin`), `axes` for extra variable axes (`axes=opsz:14..32`), `text` (only the glyphs of that text), plus `display`, `fallback` and `family` as for local files.
- One import gives one subset. Import the font again with `subset=latin-ext` (or another subset) to add more; each file only loads for the characters it covers.
- Downloads are cached in `node_modules/.rivet/fonts` (`kit({ fonts: { cacheDir } })`). With the cache in place the build needs no network. Without network and without a cache the build fails with a clear error: keep the cache in CI, or download the file and import it as a local `?font` file. Delete the folder to fetch fonts again.

Each preload competes with your main image for bandwidth. Preload one or two fonts, not all.

## Image preloads

`Picture` and `Image` from `@rivetjs/kit/image` are the runtime image components with one addition: an image with `priority` also gets a `<link rel="preload" as="image">` in the head. Set `preload={false}` to turn it off. Images with `sizes="auto"` are never preloaded. For art direction (different images per media query), each media gets its own preload, and only one of them matches.

```tsx
import { Picture } from "@rivetjs/kit/image";
import hero from "../images/hero.jpg?image";

<Picture image={hero} alt="Mountain trail" priority />;
```

See [images](../guides/assets/images.md) for `?image` imports.

## Enter and leave transitions

`<Transition show={open} enter="…" enterFrom="…" enterTo="…" leave="…" leaveFrom="…" leaveTo="…">` from `@rivetjs/kit/transition` applies CSS classes while content enters and leaves, and unmounts it after the leave transition finished (`unmount={false}` keeps it hidden). It is the same machine the cdk overlays use.

A Transition is also a presence for `@rivetjs/motion`: a Motion element with `exit` inside it plays its exit when `show` turns false, and the Transition waits for it before it unmounts. See [Presence and exit animations](../guides/motion/presence.md).

## Icons

`Icon` from `@rivetjs/kit/icon` draws a [lucide](https://lucide.dev/icons/) icon as inline SVG. Install `lucide` and import each icon you use by name; icons you do not import add nothing to the bundle:

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { ArrowRight, LoaderCircle } from "lucide";

<Icon icon={ArrowRight} size={16} />;
<Icon icon={LoaderCircle} class="animate-spin" strokeWidth={1.5} title="Loading" />;
```

- Props: `size` (default 24), `color` (default `currentColor`, so CSS `color` paints it), `strokeWidth` (default 2), `absoluteStrokeWidth` (the stroke stays `strokeWidth` pixels wide at any `size`), `title`, and any `<svg>` attribute (`class`, `style`, `aria-*`).
- The icon is hidden from screen readers unless you give it a `title` or `aria-label`.
- It renders the same on the server, in the browser and after resume. An icon with fixed props costs no resume state.
- Each icon's shapes are built once and reused: the browser clones them, the server writes one cached chunk. Treat lucide icon arrays as constants; to draw another icon, pass another array.
- In Vite builds, an `Icon` whose `icon` is a lucide import and whose other props are constants (`size`, `color`, `strokeWidth`, `absoluteStrokeWidth`, `class`, `data-*`) compiles into the SVG markup itself, so no component runs. The markup is the same. `rivet({ staticIcons: false })` (or `rivetRouter({ staticIcons: false })` in file-routed apps) turns this off.

## Strict CSP and Trusted Types

The kit works with a strict :term[Content Security Policy]{id=content-security-policy}:

- Every script tag gets the request's nonce. Static pages get hashes from `hashCSP`, which also allows the origins of your `<Script src>` files.
- JSON-LD is data, not code. It gets no nonce and no hash.
- With :term[Trusted Types]{id=trusted-types}, add the kit's policy name `rivet-script`. The kit creates this policy once per page and only lets it load the script URLs you listed.

```ts
import { strictCSP } from "@rivetjs/router/server";

strictCSP(nonce, { trustedTypes: ["rivet-script"] });
```

For static builds, pass the same list to `prerenderBuild({ csp: { trustedTypes: ["rivet-script"] } })`. See [CSP](../guides/security/csp.md) and [Trusted Types](../guides/security/trusted-types.md).

## Common mistakes

- **`kit()` without the shell change.** Without `headTags(input.head, input)`, stylesheets, nonces and client updates are missing.
- **Linking stylesheets twice.** Remove the `styles.map(...)` loop when you pass `input` to `headTags`.
- **Relative URLs in `seo()`.** Pass absolute URLs or `baseUrl`.
- **Forgetting `rivet-script`** in the Trusted Types list. Deferred scripts are then blocked.

## See also

- [Head and SEO](../guides/routing/head-and-seo.md) with route `head` exports
- [Scoped styles](../guides/styling/scoped-styles.md)
- [UI overview](./overview.md)
