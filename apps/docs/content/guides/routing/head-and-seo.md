---
title: Head and SEO
description: Set the page title, meta description, social tags and canonical links per route with a head export, including values from loader data.
template: guide
related: [guides/routing/loading-data, guides/routing/layouts, guides/routing/headers-and-caching, ui/kit]
---

Search engines and link previews read the `<head>` of your HTML: the title, the description, social tags, the canonical URL. In Rivet each route sets these with a `head` export, and the server writes them into the HTML. After reading this page you can set static and data-based head tags and know how they combine across layouts.

::example{id=head-tags}

## Set a title

Export `head` from a page. In server and static apps the server writes it into the HTML and the browser build leaves it out, along with code only `head` uses (raw CSS strings, meta helpers): on a client navigation the router receives the next page's head with its data. A CSR app has no server, so there the browser applies `head` (see [client navigation](#client-navigation)).

```tsx title="src/routes/about.tsx"
export const head = { title: "About us" };

export default function About() {
  return <h1>About us</h1>;
}
```

## Add meta and link tags

The common fields are `title`, `meta` and `links`:

```tsx title="src/routes/pricing.tsx"
import type { Head } from "@rivetjs/router";

export const head: Head = {
  title: "Pricing",
  meta: [
    { name: "description", content: "Plans and prices for teams of every size." },
    { property: "og:title", content: "Pricing" },
    { property: "og:type", content: "website" },
  ],
  links: [{ rel: "canonical", href: "https://example.com/pricing" }],
};
```

- `meta` entries use `name` (for `description`, `robots`, `twitter:card`, …), `property` (for Open Graph tags like `og:title`), `httpEquiv` or `itemprop`, plus `content`. `media` limits a tag to a media query, for example one `theme-color` per color scheme.
- `links` entries take `rel` and `href`, and optionally `type`, `hreflang`, `media`, `sizes`, `as`, `crossorigin`, `imagesrcset`, `imagesizes`, `fetchpriority`, `title`, `color`, `integrity` and `referrerpolicy`.

All fields are optional. The others:

- `titleTemplate`: a pattern for the title, see [below](#layouts-and-pages-combine).
- `scripts`: external (`src`) or inline scripts with a loading `strategy`. See the [kit](../../ui/kit.md) for inline scripts under a CSP.
- `html` and `body`: attributes for `<html>` (`lang`, `dir`, `class`) and `<body>` (`class`). The document shell writes them with `htmlAttributes(head)` and `bodyAttributes(head)` from `@rivetjs/router/head`.
- `base`: a `<base href>` (and optional `target`).
- `styles`: inline `<style>` blocks (`css`, optional `media` and `key`) for trusted CSS that components generate, such as `@rivetjs/motion` entrance rules. They carry the request's CSP nonce, render after the stylesheets, and client navigation keeps them.

The router escapes every value, so text from your database cannot break out of the tag.

::api{symbol="@rivetjs/router#Head"}

## Use loader data

Make `head` a function to build tags from the page's data. It receives `{ data, params, url }`:

```tsx title="src/routes/posts/[slug].tsx"
import type { PageProps } from "@rivetjs/router";

type Post = { title: string; summary: string; slug: string };

export const head = ({ data }: { data: Post }) => ({
  title: data.title,
  meta: [
    { name: "description", content: data.summary },
    { property: "og:title", content: data.title },
  ],
  links: [{ rel: "canonical", href: "https://example.com/posts/" + data.slug }],
});

export default function PostPage({ data }: PageProps<Post>) {
  return <h1>{data.title}</h1>;
}
```

`data` is the result of this file's own `load(…)`. A layout's `head` function gets the layout's data.

## Layouts and pages combine

Layouts can export `head` too. The router merges the heads from the outermost layout to the page; the inner one wins:

- **title:** the innermost title that is set.
- **meta:** one tag per `name`, `property`, `httpEquiv` or `itemprop`, together with its `media`; an inner tag with the same name and media replaces the outer one.
- **links:** there is only ever one `canonical`; alternates are kept one per `hreflang`; icons one per `sizes` and `media`; other links one per `rel` + `href` + `media`.
- **scripts:** one per `id`, else per `src` (inline scripts per their code).
- **styles:** one per `key`, else per CSS text.
- **html, body:** merged per attribute. **base:** the innermost wins.
- Any `meta`, `links` or `scripts` entry can set `key`: entries with the same `key` replace each other, whatever their other fields.

So a root layout can set defaults that every page may override:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";

export const head = {
  title: "Acme",
  meta: [
    { name: "description", content: "Acme makes tools for small teams." },
    { property: "og:site_name", content: "Acme" },
  ],
};

export default function Layout({ children }: LayoutProps) {
  return <main>{children}</main>;
}
```

For a common suffix, set `titleTemplate` in the layout. `%s` is replaced by the winning title, once:

```tsx title="src/routes/_layout.tsx"
export const head = { titleTemplate: "%s · Acme" };
```

A page with `title: "Pricing"` then gets `Pricing · Acme`. The template also applies to a title set in the same layout, so do not combine `title: "Acme"` with it there, or pages without their own title get `Acme · Acme`.

## The document shell writes the tags

The merged head reaches your document shell (`src/document.ts`), which turns it into HTML with `headTags`. The starter templates already do this:

```ts title="src/document.ts"
import { headTags, type DocumentShell } from "@rivetjs/router/server";

const document: DocumentShell = ({ head, styles }) => ({
  start:
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    headTags(head) +
    styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("") +
    "</head><body>",
  end: "</body></html>",
});
export default document;
```

If your shell does not call `headTags`, the `head` exports have no effect.

::api{symbol="@rivetjs/router/server#headTags"}

## Client navigation

When the user follows a link, the router updates `document.title` from the new page's head. Meta and link tags are not changed in the browser.

In a CSR app (`mode: "csr"`) the `index.html` shell has no page head. The browser builds it from the `head` exports of the route's layouts and page on the first render and on every navigation, and sets `document.title` (with the layouts' `titleTemplate`). A `head` function gets `data: undefined` there, because CSR pages have no loaders. This is fine for search engines and link previews: they load each URL as a full page and read the HTML the server sends.

With the [kit](../../ui/kit.md) installed, client navigation also updates meta tags, links and JSON-LD.

## SEO checklist

- Give every page its own `title` and `description`.
- Set a `canonical` link on pages reachable under several URLs (with and without query strings, for example).
- Return a real `404` for missing content: `throw notFound()` in the loader, so search engines drop the URL. See [errors and 404 pages](./errors-and-404.md).
- Use plain `<a href>` links between pages. Crawlers follow them; they do not click buttons. See [links and navigation](./links-and-navigation.md).
- Set the page language in the document shell (`<html lang="en">`).

## Common mistakes

- **Using server code in `head`.** `head` cannot call `load(…)` or use values imported from `*.server.ts` modules: the build checks route files as the browser sees them (and a CSR app runs `head` in the browser); the build stops with an error. Read the loader's result from `data`. See [server code in route files](./server-code-in-routes.md).
- **Setting `document.title` in a component.** The component runs on the server, where there is no `document`. Use `head`, or `<Title>` from the [kit](../../ui/kit.md).
- **Expecting meta tags to change after client navigation.** Without the kit, only the title updates in the browser.

## See also

- [Loading data](./loading-data.md)
- [Layouts](./layouts.md)
- [Headers and caching](./headers-and-caching.md)
- [Kit](../../ui/kit.md): head tags from components, SEO builders, scripts and fonts (experimental)
