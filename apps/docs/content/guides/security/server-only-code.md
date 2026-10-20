---
title: Server-only code
description: Keep secrets, database access and private logic out of the browser with server exports and .server.ts files, and know what still reaches the page.
template: guide
status: stable
related: [best-practices/secrets-in-server-files, best-practices/pass-data-not-services, guides/routing/loading-data, guides/security/csp]
---

Some code must never reach the browser: database clients, API keys, password checks. Rivet has one clear rule for this. A file whose name ends in `.server.ts` (or `.server.js`, `.server.tsx`, …) is server-only. The build stops with an error if browser code imports it.

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

## What the build checks

The router plugin watches every import in the browser build. If a browser module imports a `.server` file, directly or through another file, the build fails:

```txt
[rivet:router] /app/src/lib/db.server.ts is server-only and cannot be imported by browser code (imported from src/routes/account.tsx)
  fix: read it in a server export (`load(…)`, `actions(…)`, `onGet(…)`, …) and pass the data to the page; type-only imports (`import type`) are fine
  docs: https://rivetjs.severyn.pro/guides/security/server-only-code
```

The dev server reports the same error. The server build may import these files freely.

## Components run on the server, but are not server-only

Page components (`account.tsx`) render on the server. Their render code never runs in the browser. But the same file is also compiled for the browser, because its event handlers and bindings run there. So the component must not use server-only modules or the server exports. Load data in `load(…)` and read it in the component as `data`.

The build stops with an error when browser code in a route file (the component, `head`) uses a value imported from a `.server.ts` module, or calls a server export such as `load(…)`.

Removal does not make a value private by itself: a module-level constant that both `load(…)` and the component use stays in the browser build. Never write a secret into the route file.

## What still reaches the browser

Server-only files keep code private. They do not make data private. These things are sent to the browser:

- **Loader results.** Everything `load(…)` returns is written into the page, and sent again as JSON on client navigation. Return only the fields the page shows. Do not return a whole database row with password hashes or internal notes.
- **Values captured by handlers.** When an event handler uses a value, that value is written into the page state. See [Serializable captures](../../best-practices/serializable-captures.md).
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
- **Putting secrets in `src/document.ts`.** The document shell is server code, but anything it writes is HTML.

## See also

- [Secrets in server files](../../best-practices/secrets-in-server-files.md)
- [Pass data, not services](../../best-practices/pass-data-not-services.md)
- [Loading data](../routing/loading-data.md)
