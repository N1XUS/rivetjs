---
title: File routes
description: Create pages by adding files to src/routes. Learn how file and folder names map to URLs, and which names have a special meaning.
template: guide
related: [guides/routing/params, guides/routing/layouts, guides/routing/loading-data, reference/file-conventions]
---

In a Rivet app, every page is a file in `src/routes`. The file's path decides the page's URL. After reading this page you can add pages, group them in folders, and know which file names the router treats in a special way.

## Turn on file routes

File routes come from the `rivetRouter()` Vite plugin. The starter templates already use it:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ styles: ["src/styles.css"] })],
});
```

The plugin scans `src/routes` (change it with the `routes` option) and writes generated code to `.rivet/`. You do not edit `.rivet/`; it is rebuilt when you add or remove a route file.

::api{symbol="@rivetjs/router/vite#rivetRouter"}

## Add a page

A page is a `.tsx` (or `.jsx`) file whose default export is a component:

```tsx title="src/routes/about.tsx"
export const head = { title: "About us" };

export default function About() {
  return <h1>About us</h1>;
}
```

This file answers `/about`. The optional `head` export sets the page title (see [head and SEO](./head-and-seo.md)).

Rivet renders the component on the server. In the browser the component does not run again; only its event handlers and changed values do. See [resuming](/learn/resuming.md) if this is new to you.

## How paths map to URLs

| File in `src/routes` | URL |
| --- | --- |
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `blog/index.tsx` | `/blog` |
| `blog/[slug].tsx` | `/blog/hello`, `/blog/news`, … |
| `docs/[...path].tsx` | `/docs/a`, `/docs/a/b/c`, … |
| `[[lang]]/about.tsx` | `/about` and `/en/about` |
| `(marketing)/pricing.tsx` | `/pricing` |

- `index` stands for the folder itself.
- A name in square brackets is a URL parameter. [Route params](./params.md) explains the three kinds.
- A folder name in round brackets is a **group**. It adds nothing to the URL. Use groups to share a [layout](./layouts.md) or a [guard](./guards.md) between some pages without changing their URLs.
- Matching is case-sensitive. One trailing slash is allowed: `/about/` also matches `about.tsx`.

## Put server code in the page file

Code that must stay on the server goes in the page file itself, as exports whose names start with `server` or `on`:

```tsx title="src/routes/blog/[slug].tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { readPost } from "../../posts.server.ts"; // used only by serverLoad: removed from the browser build

export async function serverLoad({ params }: RequestEvent<"blog/[slug]">) {
  return readPost(params.slug);
}

export default function Post({ data }: PageProps<"blog/[slug]">) {
  return <h1>{data.title}</h1>;
}
```

A page or layout file can export `serverLoad`, `serverGuard`, `serverActions`, `serverHeaders`, `serverEntries`, `prerender`, and request handlers such as `onGet`. The compiler removes the server exports, and the code only they use, from the browser build. Keep database clients and secrets in `*.server.ts` modules and import them from the server exports: the build refuses to put such a module into browser code. Read [loading data](./loading-data.md), [guards](./guards.md) and [actions and forms](./actions-and-forms.md) for each export, [server code in route files](./server-code-in-routes.md) for the rules, and [server-only code](/guides/security/server-only-code.md) for the safety rules.

A plain `.ts` file (not `.tsx`) that exports request handlers (`onGet`, `onPost`, …) is an [endpoint](./endpoints.md): it answers requests with its own `Response`, for example JSON.

## Special file names

| Name | What it does |
| --- | --- |
| `_layout.tsx` | Wraps every page in its folder and in subfolders. Can have server code (`serverLoad`, `serverGuard`, …). See [layouts](./layouts.md). |
| `_404.tsx` | Page for URLs that match no route, and for loaders that throw `notFound()`. |
| `_error.tsx` | Page for other failures. See [errors and 404 pages](./errors-and-404.md). |

Of the three, only `_layout` runs server code. `_404.server.ts` or `_error.server.ts` is a build error.

## Files the router ignores

You can keep helpers next to your routes. The router skips:

- names that start with `_` other than the three above, and every file inside a folder whose name starts with `_` (for example `src/routes/_components/Card.tsx`);
- names that start with `.`;
- test files (`*.test.*`, `*.spec.*`) and type files (`*.d.ts`).

:::note
Route files resume in the browser automatically, and so do components in other files, including `_components` folders, when a route imports them (`resume.appModules`, default `true`). With `appModules: false`, list those files in `resume.modules`; an unlisted component renders on the server but its handlers do not work in production.
:::

## Which route wins

When several files could match a URL, the more specific one wins, segment by segment: a fixed name beats a `[param]`, and a `[param]` beats a `[...rest]`. So for `/blog/new`, `blog/new.tsx` wins over `blog/[slug].tsx`.

Two files that describe the same URL shape are an error, for example `blog/[slug].tsx` and `blog/[id].tsx`. The build names both files.

## Common mistakes

- **Putting a page in `src/pages`.** Only `src/routes` is scanned, unless you set the `routes` option.
- **Expecting `(group)` in the URL.** `(admin)/users.tsx` answers `/users`, not `/admin/users`. Use a plain `admin/` folder for a URL segment.
- **Importing a `.server.ts` file from a component.** The build stops with "is server-only and cannot be imported by browser code". Load the data in `serverLoad` and read it from the page's `data` prop instead.
- **Reading `window` at the top of a page component.** The component runs on the server. Move browser code into an event handler or `clientEffect`. See [window is not defined](/gotchas/window-is-not-defined.md).

## See also

- [Route params](./params.md)
- [Layouts](./layouts.md)
- [File conventions reference](/reference/file-conventions.md)
- [Rendering modes](/learn/rendering-modes.md): server, static and client-only apps
