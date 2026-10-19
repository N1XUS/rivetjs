---
title: Keep secrets in server files
description: Put API keys, database access and private logic in .server.ts files, and return only what the page shows, because loader data reaches the browser.
template: best-practice
related: [guides/security/server-only-code, best-practices/pass-data-not-services, recipes/login-form, guides/routing/loading-data]
---

**Read secrets only in files whose name ends in `.server.ts`, and never return a secret from a loader or an action.**

## Why

Route components (`.tsx`) are built twice: for the server and for the browser. Anything a component imports can end up in browser code, which anyone can read.

Files named `*.server.ts` are different. The build refuses to put them in browser code. If a component (or anything else that stays in the browser build) uses one, the build stops:

```txt
[rivet:router] ../db.server.ts is server-only and cannot be imported by browser code (imported from /app/src/routes/products.tsx)
  fix: read it in a server export (`serverLoad`, `serverActions`, `onGet`, …) and pass the data to the page; type-only imports (`import type`) are fine
  docs: https://rivetjs.severyn.pro/guides/security/server-only-code
```

Type-only imports are fine: `import type { User } from "../db.server.ts"` (or `import { type User }`) is removed before bundling and passes the check.

The second half of the rule matters as much: **everything a loader returns is sent to the browser.** For in-page navigation the browser asks the server for a page's loader data as JSON, and anyone can make that request. Values that handlers use are also written into the page itself. Do not return a full user record when the page shows a name.

## Do

```ts title="src/payments.server.ts" prefer
// Server-only: the key never leaves the server.
const key = process.env.PAYMENT_API_KEY;
if (!key) throw new Error("PAYMENT_API_KEY is not set");

export async function invoices(customer: string) {
  const response = await fetch(`https://api.payments.example/customers/${encodeURIComponent(customer)}/invoices`, {
    headers: { authorization: `Bearer ${key}` },
  });
  return (await response.json()) as { id: string; total: number; status: string }[];
}
```

```tsx title="src/routes/billing.tsx" prefer
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { invoices } from "../payments.server.ts"; // used only by serverLoad: removed from the browser build

export const serverLoad = async ({ locals }: RequestEvent) => {
  const list = await invoices(locals.customerId as string);
  // Only the fields the page shows.
  return { invoices: list.map(({ id, total, status }) => ({ id, total, status })) };
};

export default function Billing({ data }: PageProps<typeof serverLoad>) {
  return <ul>{data.invoices.map((invoice) => <li>{invoice.id}: {invoice.total} ({invoice.status})</li>)}</ul>;
}
```

The page's `serverLoad` may import the `.server.ts` module: the compiler removes `serverLoad`, and the imports only it uses, from the browser build. The component itself must not use anything from that module.

## Don't

```tsx title="src/routes/billing.tsx" avoid
// A normal module: nothing stops it from reaching the browser.
import { key } from "../config.ts";

export default function Billing() {
  return <button type="button" onClick={() => fetch("https://api.payments.example/invoices", { headers: { authorization: key } })}>Load</button>;
}
```

The handler runs in the browser, so `key` is written into the page.

## When to break it

- **Public keys.** Some keys are meant for the browser (a map tile key limited to your domain, an analytics site id). Those can live in normal modules. Vite exposes environment variables to browser code only when their name starts with `VITE_`; keep secret names without that prefix.
- **Static builds.** Loaders run at build time, and their results are written into files on your host. Treat everything they return as public.
