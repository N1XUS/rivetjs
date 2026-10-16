---
title: Route params
description: Use [id], [[optional]] and [...rest] in file names to read parts of the URL in pages, loaders and guards.
template: guide
related: [guides/routing/file-routes, guides/routing/loading-data, guides/routing/typed-routes]
---

Many pages share one shape: `/items/1`, `/items/2`, `/items/3`. You write one file for all of them and read the changing part, the **param**, from the URL. After reading this page you can use the three kinds of params and read them on the server and in the page.

::example{id=route-params}

## One segment: `[name]`

Square brackets in a file or folder name match exactly one URL segment:

```tsx title="src/routes/items/[id].tsx"
import type { PageProps } from "@rivetjs/router";

export default function Item({ params }: PageProps<"items/[id]">) {
  return <h1>Item {params.id}</h1>;
}
```

`PageProps<"items/[id]">` takes the param names from the file path, so `params.id` is a `string`. See [typed routes](./typed-routes.md).

| URL | `params` |
| --- | --- |
| `/items/42` | `{ id: "42" }` |
| `/items/hello%20world` | `{ id: "hello world" }` |
| `/items` | no match |
| `/items/1/edit` | no match |

Params are always strings. Convert them yourself, for example `Number(params.id)`, and check the result.

Folders can be params too: `users/[userId]/posts/[postId].tsx` gives `{ userId, postId }`. Each name may appear only once per path.

## Optional segment: `[[name]]`

Double brackets make a segment optional. A common use is a language prefix:

```txt
src/routes/[[lang]]/about.tsx   →   /about        params: {}
                                    /de/about     params: { lang: "de" }
```

When the segment is missing, the param is not in `params` at all. Read it with a default: `params.lang ?? "en"`.

## Rest of the URL: `[...name]`

Three dots match all remaining segments, with the slashes kept. It must be the last part of the path:

```txt
src/routes/docs/[...path].tsx  →  /docs/guide/intro   params: { path: "guide/intro" }
```

A rest param also matches the folder itself with an empty string: `/docs` gives `{ path: "" }`, unless a `docs/index.tsx` exists, which wins.

## Decoding

The router decodes each segment once, so `%20` becomes a space. An encoded slash (`%2F`) stays inside its segment: `/items/a%2Fb` gives `{ id: "a/b" }`. A URL with a broken escape, such as `/items/%E0%A4%A`, matches no route and shows the [404 page](./errors-and-404.md).

## Read params on the server

Guards, loaders, actions and endpoints get the same params on their event object:

```tsx title="src/routes/items/[id].tsx"
import { notFound, type RequestEvent } from "@rivetjs/router";
import { findItem } from "../../db.server.ts";

export async function serverLoad({ params, signal }: RequestEvent<"items/[id]">) {
  const item = await findItem(params.id, { signal });
  if (!item) throw notFound();
  return item;
}
```

The type argument `RequestEvent<"items/[id]">` takes the params from the route id. You can also write them by hand: `RequestEvent<{ id: string }>`. [Typed routes](./typed-routes.md) explains the generated route list.

::api{symbol="@rivetjs/router/server#RequestEvent"}

## Read params in a page

Pages get `params` as a prop, next to `data` and `url`:

```tsx
export default function Item({ data, params, url }: PageProps<"items/[id]">) {
  return (
    <article>
      <h1>{data.title}</h1>
      <p>Item {params.id}, page {url.searchParams.get("page") ?? "1"}</p>
    </article>
  );
}
```

`PageProps<"items/[id]">` gives both: `params` from the file path and `data` from the route's `serverLoad`. `params` and `url` are fixed for one render of the page. When the user goes to another URL, the router renders the page again with new values.

Nested layouts get `params` as a function: call `params()` to read them. The root layout (`src/routes/_layout.tsx`) wraps every route, so it gets no params. Read `url()` there if you need the path.

## Query strings are not params

`?page=2` is not part of the route. Read it from `url.searchParams` in the page, or from `event.url.searchParams` in a loader. The router keeps the query when it matches, and a new query string loads the route's data again. In components that are not pages, such as a layout or a filter bar, read it with `useSearchParams()` and change it with `setSearchParams()`; see [search params](./links-and-navigation.md#search-params).

## Prerendering pages with params

In a static site (`mode: "static"`), the build must know which param values exist. Export `serverEntries` from the page file:

```tsx title="src/routes/blog/[slug].tsx"
import type { RequestEvent } from "@rivetjs/router";
import { readPosts } from "../../posts.server.ts";

export const serverEntries = async () => (await readPosts()).map((post) => ({ slug: post.slug }));
export const serverLoad = async ({ params }: RequestEvent<"blog/[slug]">) =>
  (await readPosts()).find((post) => post.slug === params.slug);
```

The build renders one HTML file for each entry. Without `serverEntries`, a param route that has a `serverLoad` or `serverGuard` is a build error in static mode. See [loading data](./loading-data.md#static-sites-load-at-build-time).

## Common mistakes

- **Treating `params.id` as a number.** It is a string. `params.id === 42` is always false.
- **Two param names for the same shape.** `[id].tsx` and `[slug].tsx` in one folder both match `/:x`; the build reports a route conflict.
- **A rest param in the middle.** `[...path]/edit.tsx` is an error. Put the rest param last.

## See also

- [File routes](./file-routes.md)
- [Typed routes](./typed-routes.md)
- [Paginated list from the URL](/recipes/paginated-list-from-url.md)
