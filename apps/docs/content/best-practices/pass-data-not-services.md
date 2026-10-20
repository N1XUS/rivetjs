---
title: Pass data, not services
description: Load data in server code and pass plain values to components, instead of passing database clients or API objects into the component tree.
template: best-practice
related: [guides/routing/loading-data, best-practices/serializable-captures, best-practices/secrets-in-server-files, guides/security/server-only-code]
---

**Fetch data in a `load(…)` loader and give components plain values. Do not pass database clients, API clients or other objects with methods to components.**

## Why

A component runs once, on the server. Its handlers run later, in the browser. Everything a handler uses must travel from the server to the browser inside the page, as data. This is called being **serializable**: it can be written as text and read back.

- Plain objects, arrays, strings, numbers, dates, `Map` and `Set` travel fine.
- A database client or an API client is a class instance with methods and open connections. It cannot travel. Rivet stops with "class instances are not serializable" or "function is not serializable". A client that belongs in the browser (an analytics or socket client) can be built there with [`reconstruct(() => …)`](../learn/resuming.md#library-objects-reconstruct); a server-side service stays behind a loader.
- Even when nothing captures it, a service imported by a page module drags its code (and maybe its secrets) toward the browser. The build refuses `.server.ts` imports in browser code, but an ordinary module has no such guard.

Loaders also make the data flow visible: what the page receives is exactly what `load(…)` returns.

## Do

```tsx title="src/routes/products.tsx" prefer
import type { PageProps } from "@rivetjs/router";
import { db } from "../db.server.ts"; // used only by the loader: removed from the browser build
import { load } from "@rivetjs/router";

type Product = { id: string; name: string; price: number };

export const loader = load(async () => ({
  products: (await db.query("select id, name, price from products order by name")) as Product[],
}));

export default function Products({ data }: PageProps<typeof loader>) {
  return (
    <ul>
      {data.products.map((product) => (
        <li>{product.name}: {product.price}</li>
      ))}
    </ul>
  );
}
```

For changes, post a form to an [action](/guides/routing/actions-and-forms.md), or `fetch` an [endpoint](/guides/routing/endpoints.md) from a handler. The service stays on the server.

## Don't

```tsx title="src/routes/products.tsx" avoid
import { ProductApi } from "../api.ts";

export default function Products() {
  const api = new ProductApi(); // a class instance
  return (
    <button type="button" onClick={() => api.refresh()}>
      Refresh
    </button>
  );
}
```

The handler captures `api`, and the compiler stops: `api` is a class instance and cannot be written into the page.

## When to break it

- **Browser-only helpers.** A module that only uses browser APIs (a formatter, a small fetch wrapper) can be imported by handlers directly. The handler imports it; it is not captured.
- **Context with an id.** Some values (a theme, a locale) are provided to many components. Use context created with an `id` so the browser can provide the same value. See [context](/guides/components/context.md).
