---
title: Server code in route files
description: Keep loaders, guards, actions and request handlers in the page file with load(…), onGet(…) and more; the compiler removes them from browser code.
template: guide
status: experimental
related: [guides/routing/loading-data, guides/routing/endpoints, guides/security/server-only-code, guides/routing/typed-routes]
---

A route's server code lives in the page or layout file itself, next to the component. You mark it by wrapping it in a function from `@rivetjs/router`: `export const loader = load(…)`, `export const GET = onGet(…)`, and so on. Those exports run only on the server, and the compiler removes them, and everything only they use, from the browser build. This is the form all routing guides use. After reading this page you know the wrappers, how to type a page from its loader, how request handlers work, and what the compiler checks.

::example{id=server-load-inline}

## One file per route

```tsx title="src/routes/items/[id].tsx"
import { notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { db } from "../../db.server.ts"; // used only by the loader: removed from the browser build

export const loader = load(async ({ params }: RequestEvent<"items/[id]">) => {
  const item = await db.items.find(params.id);
  if (!item) throw notFound();
  return item;
});

export default function Item({ data }: PageProps<typeof loader>) {
  return <h1>{data.title}</h1>;
}
```

- `load(…)` gets the request event and runs on the server before the page renders. See [loading data](./loading-data.md). `load(…, { defer: true })` runs with it but streams its part later: [deferred loaders](./loading-data.md#deferred-loaders).
- `PageProps<typeof loader>` takes the data type from the loader. You do not write it by hand.
- `PageProps<"items/[id]">` uses the route id (the file path without extension) instead: it gives `params` from the file name and `data` from the route's `load(…)`. Use it when the page reads params. See [typed routes](./typed-routes.md).
- `RequestEvent<"items/[id]">` takes the params from the route id in the same way.

## The wrappers

Import them from `@rivetjs/router`. In a page or layout file (`.tsx`):

| Export | Does |
| --- | --- |
| `load((event) => …)` | Data for the page or layout (`data` prop). See [loading data](./loading-data.md). |
| `guard((event) => …)` | Runs before loaders; return or throw `redirect()`, `deny()`, … to stop. See [guards](./guards.md). |
| `actions({ … })` | Form actions, `{ name: (event) => result }`. See [actions and forms](./actions-and-forms.md). |
| `entries(() => […])` | Param values for static prerendering. See [params](./params.md#prerendering-pages-with-params). |
| `headers((event) => …)` | Response headers. See [headers and caching](./headers-and-caching.md). |
| `prerender` | A plain flag: `export const prerender = true`. |

The export name is yours: `export const pageData = load(…)` works the same. The guides use `loader`, `access`, `forms`, `paths`, `responseHeaders`, `middleware` and `GET` / `POST` / …. Each wrapper may appear once per file (request handlers once per method). The wrapper's parameter types come from the call: `({ params }) => …` gets a typed `RequestEvent` without an annotation.

## Request handlers: `onGet(…)`, `onPost(…)`, …

`onRequest(…)` (any method), `onGet(…)`, `onPost(…)`, `onPut(…)`, `onPatch(…)`, `onDelete(…)` and `onOptions(…)` see the request before anything else:

- Return a `Response` to answer the request yourself.
- Throw `redirect()` or an HTTP error to stop, as in a guard.
- Return nothing to let the request continue: then the guards run, then actions, then loaders, then the page renders.

They run for each module from the outermost layout to the page, `onRequest(…)` before `onGet(…)` / `onPost(…)` / …. `onRequest(…)` runs for every method, before the router checks whether the page accepts it: a layout can answer a `POST` to a page that has no actions. A page that exports `onPut(…)`, `onPatch(…)`, `onDelete(…)` or `onPost(…)` also accepts that method; anything else then gets `405` with an `Allow` header listing only what the page handles.

```tsx title="src/routes/index.tsx"
// /?format=json answers with the loader's data as JSON; other requests render the page.
import { onGet } from "@rivetjs/router";
export const GET = onGet(async (event: RequestEvent) =>
  event.url.searchParams.get("format") === "json" ? Response.json(await loader(event)) : undefined);
```

:::warning
Request handlers run **before** guards, including the guards of enclosing layouts. A `guard(…)` in `(private)/_layout.tsx` does not protect a page's `onGet(…)`. Check access inside the handler, or keep protected data out of it.
:::

## Endpoints in plain `.ts` files

A `.ts` file (not `.tsx`) in `src/routes` that exports request handler calls is an [endpoint](./endpoints.md):

```ts title="src/routes/api/time.ts"
import type { RequestEvent } from "@rivetjs/router";
import { onGet } from "@rivetjs/router";

export const GET = onGet(({ url }: RequestEvent) =>
  Response.json({ now: new Date().toISOString(), zone: url.searchParams.get("zone") ?? "UTC" }));
```

Here the handler must return a `Response`. A `.ts` file without request handlers stays a helper module and adds no route.

## What the compiler removes

For the browser build, the compiler deletes every export made by a wrapper call (it follows the import from `@rivetjs/router`, also renamed: `import { load as l }`), plus module-level functions, variables and imports that only those exports use. Type references do not count, so `typeof loader` stays legal. Lines and positions stay the same, so source maps and error locations still match.

The build stops with an error when:

- browser code (the component, `head`) uses a server export, for example calls `load(…)`;
- browser code uses an import from a server-only module (`*.server.ts`, `node:…`, or a module that imports `@rivetjs/router/server-only`);
- one `export const` declares a server export and a browser value together (`export const loader = load(…), x = …`);
- a wrapper is used anywhere but as the whole value of a module-level `const` (`export const x = load(…)`);
- two exports use the same wrapper (`load(…)` twice, or `onGet(…)` twice);
- an export still has an old magic name (`serverLoad`, `onGet`, …) without a wrapper call (RV3010; the editor offers a quick fix);
- the route file uses `export *`.

## Where secrets go

Removal is not the only protection. Keep database clients, API keys and other secrets in `*.server.ts` modules, and import them from the server exports. If such an import ever stays in browser code, the build fails instead of shipping it. For a module you cannot rename, add this line at its top:

```ts title="src/lib/payments.ts"
import "@rivetjs/router/server-only";
```

Never write a secret directly into the route file: a constant that the component also reads stays in the browser build. See [secrets in server files](/best-practices/secrets-in-server-files.md).

## Loader data must be plain data

`PageProps<typeof loader>` also checks that the data can travel to the browser: a function or a class instance in the loader's result is a type error on `data`. If you know better, opt out with `PageProps<Unchecked<typeof loader>>` (`Unchecked` is exported from `@rivetjs/router`).

## Sibling `.server.ts` files

A separate `x.server.ts` next to the page works too, with the same wrappers; its exports are merged with the page file's, and the same wrapper in both is an error.

## Migrating from export names

Earlier versions found server code by export name (`serverLoad`, `onGet`, and `load`, `GET`, … in `.server.ts` files). Those names are now errors. The codemod rewrites them to wrapper calls and renames every reference:

```bash
npx rivet migrate server-exports --dry-run   # show what would change
npx rivet migrate server-exports             # rewrite (default folder: src/routes)
```

## In the dev server

- Adding or removing a server export updates the route table and reloads the page.
- Editing server-only code (a `*.server.ts` file or an in-file loader) makes the open page fetch its data again and re-render. Component state resets.

## Common mistakes

- **A loader without its wrapper.** `export const loader = async () => …` is a plain browser export. Wrap it: `export const loader = load(async () => …)`.
- **A wrapper inside a function or condition.** `cond ? load(a) : load(b)` is an error. Pick the function inside one `load(…)` call.
- **Protecting a page's `onGet(…)` with a layout guard.** Handlers run first; see the warning above.
- **Calling `load(…)` from an event handler.** It does not exist in the browser. Send changes through an action or an endpoint.

## See also

- [Loading data](./loading-data.md)
- [Endpoints](./endpoints.md)
- [Server-only code](/guides/security/server-only-code.md)
- [Typed routes](./typed-routes.md)
