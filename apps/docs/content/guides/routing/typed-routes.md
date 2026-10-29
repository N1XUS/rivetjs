---
title: Typed routes
description: Let TypeScript check route params, loader data, action results and link targets with the route types Rivet generates in .rivet/routes.d.ts.
template: guide
related: [guides/routing/params, guides/routing/links-and-navigation, guides/tooling/language-service]
---

Rivet knows every route in `src/routes`, so it writes their types for you. TypeScript can then check that a page reads params that exist, gets the data its loader returns, and that a `<Link>` points to a real page. After reading this page you can turn the types on and use them in pages, layouts, loaders, actions and links.

## Turn the types on

The `rivetRouter()` Vite plugin writes `.rivet/routes.d.ts` whenever it starts (dev server or build) and whenever you add or remove a route file. Add the file to your `tsconfig.json`:

```json title="tsconfig.json"
{
  "compilerOptions": {
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "@rivetjs/runtime"
  },
  "include": ["src", "*.ts", ".rivet/routes.d.ts"]
}
```

The starter templates already include it. Run `npx rivet sync` once after cloning, so the file exists before you run the type check (`tsgo` or `tsc`); dev and build generate it too.

## What the file contains

For these routes:

```txt
src/routes/
  index.tsx
  items/[id].tsx
  docs/[[lang]]/[...path].tsx
  api/health.ts
```

the generated file looks like this:

```ts title=".rivet/routes.d.ts"
declare module "@rivetjs/router" {
  interface RouteParams {
    "index": {};
    "items/[id]": { id: string };
    "docs/[[lang]]/[...path]": { lang?: string; path: string };
    "api/health": {};
  }
  interface RouteRegistry {
    path: `/` | `/items/${string}` | `/docs/${string}` | `/docs/${string}/${string}`;
  }
}
export {};
```

- `RouteParams` maps each **route id** (the file path without extension) to its params. Optional segments give optional params.
- `RouteRegistry["path"]` lists the URL shapes of all pages (not endpoints). Each param becomes `${string}`.
- When routes have loaders, the file also fills `RouteData`: route id → the type its `load(…)` returns.
- Routes with server code also get `RouteActions` (route id → their `actions(…)`), and layouts get `LayoutParams` and `LayoutData`, keyed by **layout id**: the layout's file path without extension, such as `"_layout"` or `"items/_layout"`.

From `@rivetjs/router` you import the types built on them:

| Type | Meaning |
| --- | --- |
| `RouteParams` | Route id → params object. |
| `RouteId` | Union of all route ids, such as `"items/[id]"`. |
| `PageProps<"items/[id]">` | Props of that page: `params`, `data` (from its loader) and `url`. |
| `LayoutProps<"items/_layout">` | Props of that layout: `data()`, `params()`, `url()` and `children`. |
| `RoutePath` | Union of page URL shapes, such as `` `/items/${string}` ``. Plain `string` when `routes.d.ts` is not in the program. |
| `LinkHref` | A `RoutePath`, optionally followed by `?query` or `#hash`. The type of `<Link to>`. |

## Type pages by route id

Give `PageProps` the route id, and the page gets its params and its loader's data without a hand-written type:

```tsx title="src/routes/items/[id].tsx"
import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { db } from "../../db.server.ts";

export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => {
  const item = await db.items.find(params.id);
  if (!item) throw notFound();
  return item;
});

export default function ItemPage({ data, params }: PageProps<"items/[id]">) {
  return <h1>{data.title} ({params.id})</h1>;
}
```

- `params` comes from the file path: `[id]` gives `id: string`, `[[lang]]` gives `lang?: string`, `[...path]` gives `path: string`.
- `data` is what `load(…)` returns. A route without a loader has `data: undefined`.
- `RequestEvent<"items/[id]">` types the loader's `params` the same way.
- `PageProps<typeof loader>` and `PageProps<Item, { id: string }>` keep working.

Rename `[id]` to `[itemId]`, and every `params.id` and every `PageProps<"items/[id]">` becomes an error: TypeScript shows every place to update. A route id that does not exist makes `data` and `params` unusable instead of silently `any`.

## Type layouts by layout id

```tsx title="src/routes/items/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const loader = load(() => ({ categories: ["books", "music"] }));

export default function ItemsLayout({ data, params, children }: LayoutProps<"items/_layout">) {
  return <section data-item={params().id}>{data().categories.join(", ")}{children}</section>;
}
```

- Layout props stay accessors (`data()`, `params()`): a layout can stay mounted while the page under it changes.
- The root layout (`"_layout"`) stays mounted across all pages and gets no params. A nested layout gets the params of the pages under it; a param is optional unless every page under the layout has it.

## Type action results

`actionResult()` takes the route id too:

```tsx
import { actionResult } from "@rivetjs/router/client";

const save = actionResult<"items/[id]", "save">("save");
if (save?.status !== undefined) save.result.error; // the data passed to fail(400, …)
```

- With only the route id (`actionResult<"items/[id]">()`) the result is a union over the route's actions; check `name` to narrow it.
- `status` is set for `fail(status, data)`, and `result` is `data`; otherwise `result` is what the action returned. Actions that return `redirect()` or a `Response` have no result type.
- An action name the route does not define is a type error.

::api{symbol="@rivetjs/router#RouteParams"}

## Type links

`<Link>` from `@rivetjs/router/link` takes a `to` of type `LinkHref`:

```tsx
import { Link } from "@rivetjs/router/link";

<Link to="/">Home</Link>;
<Link to={`/items/${item.id}`}>{item.title}</Link>;
<Link to="/items/42?tab=reviews#top">Reviews</Link>;
<Link to="/itemz/42">Typo</Link>; // error: not assignable to type 'LinkHref'
```

Params are only checked as "some string": `/items/anything` passes. The check catches typos and links to pages that were moved or deleted. Plain `<a href>` is not checked. See [links and navigation](./links-and-navigation.md) for what `<Link>` adds.

You can type your own helpers with `RoutePath` too:

```ts
import type { RoutePath } from "@rivetjs/router";

export const itemPath = (id: string): RoutePath => `/items/${encodeURIComponent(id)}`;
```

## What is not typed

- **Query strings.** `?tab=…` is any string. Read and check values from `url.searchParams` yourself.
- **Endpoints in links.** `RoutePath` lists pages only. Link to an endpoint with a plain `<a href>`.

## Common mistakes

- **`routes.d.ts` missing from `include`.** Then `RoutePath` is `string` and every link passes. Check `tsconfig.json`.
- **Type-checking before generating route types.** `.rivet/` is generated, so a fresh checkout has no `routes.d.ts`. Run `npx rivet sync` before `tsgo` / `tsc`, as the starters' `npm run check` does.
- **Using the URL instead of the route id.** `RouteParams["/items/:id"]` does not exist. The key is the file path: `"items/[id]"`, and group folders stay in it: `"(shop)/cart"`.

## See also

- [Route params](./params.md)
- [Links and navigation](./links-and-navigation.md)
- [Language service](/guides/tooling/language-service.md)
