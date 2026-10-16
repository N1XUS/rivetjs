---
title: Static hosts
description: Render every page to an HTML file at build time with prerenderBuild, and deploy the dist/client folder to any static host.
template: guide
status: experimental
related: [guides/deploy/node, guides/routing/loading-data, guides/security/csp, guides/routing/params]
---

A static site needs no server of its own. At build time, Rivet renders every page to an HTML file. You upload the folder to any static host or CDN. The pages still resume in the browser: buttons and other interactive parts work without running your components again.

After reading this page you can build a static site, choose which pages to :term[prerender]{id=prerender}, preview it and deploy it.

::starter{template=starter-static}

## Set static mode

Set `mode: "static"` in the router plugin:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ mode: "static", styles: ["src/styles.css"] }), tailwindcss()],
});
```

## Build

A static build has three steps: the browser build, the server build, and prerendering with the server build.

```json title="package.json"
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && vite build --ssr && node prerender.js",
    "preview": "node serve.js"
  }
}
```

```js title="prerender.js"
import { prerenderBuild } from "@rivetjs/router/static";

const report = await prerenderBuild({ dist: "dist" });
console.log(`Prerendered ${report.pages.length} page(s) into dist/client`);
```

`prerenderBuild` writes into `dist/client`, so that folder is the whole site:

```txt
dist/client/
  index.html          /
  _data.json          data for client navigation to /
  about/index.html    /about
  about/_data.json
  404.html            your _404 page
  assets/             chunks, CSS, images
```

The `_data.json` files hold the route data. When a visitor clicks a link on an interactive page, the browser loads the next page's data from there instead of a full page.

## Pages without JavaScript

A page with nothing to resume ships no JavaScript at all: no loader, no state script, no preload links. Nothing to resume means no event handlers, no signals read in the markup, no `clientEffect` and no forms. The build decides this per page, from what each page actually rendered. A mixed site keeps JavaScript on its interactive pages only.

On such a page, links load the next document, like on any static site. The client router does not count as a reason to ship JavaScript in `mode: "static"`. To keep in-place navigation on every page, set `rivetRouter({ clientRouter: true })` (the default in `mode: "server"`).

When no page resumes at all:

- no `_data.json` files are written, because nothing navigates in place;
- `prerenderBuild` deletes the scripts no page references (`prune: false` keeps them).

A content site (articles, tags, listing pages) then deploys only HTML, CSS and images.

## Site origin

Pass your site's address as `origin` when pages build absolute URLs from the request URL, for example a canonical link or `og:url`:

```js title="prerender.js"
await prerenderBuild({ dist: "dist", origin: "https://example.com" });
```

Without it, pages are rendered for `http://localhost`. Resume state and `_data.json` store same-origin URLs as paths, so they work on any host. If a page's state or data still holds `http://localhost`, the build fails and names the value. That happens with a URL string built from `url.href`.

::api{symbol="@rivetjs/router/static#prerenderBuild"}

## Which pages are built

- Every route without parameters, like `about.tsx`.
- Routes with parameters, like `blog/[slug].tsx`, when the page exports `serverEntries()`, the list of parameter values to build.
- A page can set `export const prerender = false` to skip a route, or `true` to force it.

```tsx title="src/routes/blog/[slug].tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { posts } from "../../content/posts.ts";

export const serverEntries = () => posts.map((post) => ({ slug: post.slug }));

export const serverLoad = ({ params }: RequestEvent<"blog/[slug]">) => {
  const post = posts.find((p) => p.slug === params.slug);
  return { title: post!.title, body: post!.body };
};

export default function Post({ data }: PageProps<typeof serverLoad>) {
  return (
    <article>
      <h1>{data.title}</h1>
      <p>{data.body}</p>
    </article>
  );
}
```

`serverLoad` and `serverGuard` run at build time, once per page. There is no request from a visitor, so there are no cookies and no per-user data. Actions do not exist on a static site.

The build fails when:

- a route with `serverLoad` or `serverGuard` cannot be prerendered (dynamic, no `serverEntries()`). The message says to use the [Node adapter](node.md) or add `serverEntries()`;
- a page does not answer with status 200.

Dynamic routes without server code and without `serverEntries()` need a browser-rendered fallback page. Pass `shell` to `prerenderBuild`; the result is written to `200.html`. Most apps avoid this by adding `serverEntries()`.

## Security policy

Each page gets a `<meta>` Content Security Policy, placed right after `<meta charset>` and `<meta name="viewport">`. It allows its own inline scripts by hash and script files from the same origin. Turn on Trusted Types with `csp: { trustedTypes: true }`, add sources such as `'wasm-unsafe-eval'` or `worker-src blob:` with `csp: { directives }`, or turn the tag off with `csp: false` if your host sends the header. See [Content Security Policy](../security/csp.md#static-pages-a-hash-policy).

## Preview

Check the built site locally before you deploy. The static starter includes a small `serve.js` that behaves like a static host: folders serve their `index.html`, missing paths get `404.html`, and `/about` redirects to `/about/`.

```bash
npm run build
npm run preview
```

It uses `serve()` from `@rivetjs/router/node` with a handler for folders and missing files. Use it only for previews.

## Deploy

Upload `dist/client` to your host. Settings that most hosts ask for:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Output / publish folder | `dist/client` |
| 404 page | `404.html` (most hosts find it automatically) |

Caching:

- Files in `assets/` have a content hash in their name. Cache them for a long time (`Cache-Control: public, max-age=31536000, immutable`).
- HTML and `_data.json` files keep their names between builds. Cache them briefly, or revalidate them, so visitors get new content after a deploy.

The site works from the root of a domain. Folders map to URLs with a trailing slash (`/about/`); most hosts handle this for you.

## Common mistakes

- **Pages missing after the build.** A dynamic route has no `serverEntries()`, or `serverEntries()` returns fewer values than you think. The report lists every built page.
- **Testing with the dev server only.** Dev pages render in the browser and do not show resuming. Run `npm run build && npm run preview`.
- **Expecting cookies or per-user content.** A static page is the same for every visitor. Use the [Node adapter](node.md) for that.

## See also

- [Node](node.md)
- [Loading data](../routing/loading-data.md)
- [Params](../routing/params.md)
