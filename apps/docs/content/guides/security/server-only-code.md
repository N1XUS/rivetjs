---
title: Server-only code
description: Keep secrets, database access and private logic out of the browser with server exports and .server.ts files, and know what still reaches the page.
template: guide
status: stable
related: [best-practices/secrets-in-server-files, best-practices/pass-data-not-services, guides/routing/loading-data, guides/security/csp]
---

Some code must never reach the browser: database clients, API keys, password checks. Rivet has one clear rule for this. A file whose name ends in `.server.ts` (or `.server.js`, `.server.tsx`, …) is server-only. Browser code never gets it: the build either keeps the page out of the browser or stops with an error.

After reading this page you know where to put server code, what the build checks, and which data still ends up in the page.

## Put server code in server exports and .server.ts files

In a file-routed app, a page's server code lives in the page file, in exports made by a wrapper call from `@rivetjs/router` (`load(…)`, `guard(…)`, `actions(…)`, request handlers such as `onGet(…)`). The compiler removes them, and everything only they use, from the browser build:

```tsx title="src/routes/account.tsx"
import { redirect, type PageProps, type RequestEvent, guard, load } from "@rivetjs/router";
import { db } from "../lib/db.server.ts"; // used only by the server exports

export const access = guard(async ({ cookies }: RequestEvent) => {
  if (!cookies.get("session")) throw redirect("/login");
});

export const loader = load(async ({ cookies }: RequestEvent) => {
  const user = await db.userBySession(cookies.get("session")!);
  return { name: user.name, plan: user.plan };
});

export default function Account({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>Hello, {data.name}</h1>
      <p>Plan: {data.plan}</p>
    </main>
  );
}
```

Secrets and database clients go in modules whose name ends in `.server.ts`, such as `src/lib/db.server.ts`, anywhere in `src`. The rule is about the file name, not the folder. See [server code in route files](../routing/server-code-in-routes.md) for all export names.

## What counts as server-only

- files named `*.server.*` (`db.server.ts`, `report.server.tsx`);
- modules that `import "@rivetjs/router/server-only"`;
- modules you list in the router option `serverOnly`, by id or pattern. Use it for virtual modules and generated data:

```ts title="vite.config.ts"
rivetRouter({ serverOnly: ["virtual:content", /\/generated\/.*\.json$/] });
```

Vite plugins can declare their own (the docs engine marks `virtual:docs/api` this way). The server build may import all of these freely.

## What the build checks

Page components (`account.tsx`) render on the server. But the same file is also compiled for the browser, because its event handlers and bindings run there, and on a client navigation the browser renders the next page itself. Before it builds, the router follows the imports of every page, layout and error page as the browser would see them.

**A page that uses a server-only module itself** (in its component or `head`, or through a plain helper module that is not a component) becomes a **document route**. Links to it load the document from the server, like links with `data-rivet-reload`; the client router never renders it, and its page code leaves the browser build. Nothing else changes: the server renders it on every request as before. Write `import "@rivetjs/router/server-only"` in a page module to make it a document route on purpose.

**A component that uses a server-only module** stops the build when a client-navigated page renders it, because the browser would render the component on the next navigation. The error names the import chain and the pages:

```txt
[rivet:router] RV3011 @rivetjs/docs-kit/components/ApiCard.tsx → @rivetjs/docs-kit/api.ts → virtual:docs/api (server-only), rendered by /learn/signals, /guides/state/signals and 28 more (client-navigated page routes)
  fix: pass the data to the component as props (inlined at build time, or read in the page's `load(…)`), keep server-only modules out of components, or make the page a document route (`import "@rivetjs/router/server-only"` in the page module); `rivetRouter({ serverOnly: { reach: "warn" } })` turns this into a warning (those pages render as document routes)
  docs: https://rivetjs.severyn.pro/errors/RV3011
```

The dev server shows the same message in the error overlay and the terminal when you open the page. With `serverOnly: { modules: [...], reach: "warn" }` it is a warning instead, and those pages become document routes. Layouts and error pages are rendered by every page under them, so they can never be document routes: a layout that reaches a server-only module is always an error. Read the data in the layout's `load(…)`.

Where a document route's resumed parts still name a server-only module, the browser gets a stand-in that throws `… is server-only; reached from …` on any use, never the module or an empty value. Other browser imports of a server-only module stop the build:

```txt
[rivet:router] /app/src/lib/db.server.ts is server-only and cannot be imported by browser code (imported from src/routes/account.tsx)
  fix: read it in a server export (`load(…)`, `actions(…)`, `onGet(…)`, …) and pass the data to the page; type-only imports (`import type`) are fine
  docs: https://rivetjs.severyn.pro/guides/security/server-only-code
```

Server exports such as `load(…)` may use server-only modules: the compiler removes them, and the imports only they use, from the browser build. Calling a server export from the component is still an error.

Removal does not make a value private by itself: a module-level constant that both `load(…)` and the component use stays in the browser build. Never write a secret into the route file.

## What still reaches the browser

Server-only files keep code private. They do not make data private. These things are sent to the browser:

- **Loader results.** Everything `load(…)` returns is written into the page, and sent again as JSON on client navigation. Return only the fields the page shows. Do not return a whole database row with password hashes or internal notes.
- **Values written into the page.** Route data, signal values and plain-data props of interactive components are written into the page. See [what reaches the browser](../../learn/resuming.md#what-reaches-the-browser).
- **The HTML.** Anything you render is visible in the page source.

```ts
// Don't: the whole row reaches the browser.
return await db.user(id);

// Do: pick the fields the page needs.
const user = await db.user(id);
return { name: user.name, avatar: user.avatarUrl };
```

## Secrets and environment variables

Read secrets in `.server.ts` files, from `process.env`:

```ts title="src/lib/payments.server.ts"
const key = process.env.PAYMENT_API_KEY;
if (!key) throw new Error("PAYMENT_API_KEY is not set");

export async function charge(amount: number) {
  // ...uses key
}
```

Vite puts variables with the `VITE_` prefix into browser code through `import.meta.env`. Never give a secret this prefix.

## Static sites

In a static build (`mode: "static"`), server code runs at build time, during prerendering. It is not deployed at all, but its results are in the HTML and `_data.json` files. The same rule applies: return only data that may be public.

A route with `load(…)` or `guard(…)` and no prerender entries cannot be built as a static page; the build tells you to use the Node adapter or add `entries(…)`.

## Common mistakes

- **Importing a server helper into a route file "just for a type" without `type`.** `import { User } from "./db.server.ts"` is a value import and fails the browser build. Write `import type { User }` (or `import { type User }`): type-only imports are removed before bundling and pass the check.
- **Naming a file `db.ts` instead of `db.server.ts`.** Then nothing stops a browser import. Use the suffix for every file that holds secrets.
- **Reading server data in a shared component.** A component used by many pages makes all of them fail with RV3011. Read the data in the page (or its `load(…)`) and pass it down as props.
- **Putting secrets in `src/document.ts`.** The document shell is server code, but anything it writes is HTML.

## See also

- [Secrets in server files](../../best-practices/secrets-in-server-files.md)
- [Pass data, not services](../../best-practices/pass-data-not-services.md)
- [Loading data](../routing/loading-data.md)
