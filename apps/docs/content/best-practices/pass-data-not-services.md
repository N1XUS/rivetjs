---
title: Pass data, not services
description: Load data in server code and pass plain values to components, instead of passing database clients or API objects into the component tree.
template: best-practice
related: [guides/routing/loading-data, learn/resuming, best-practices/secrets-in-server-files, guides/security/server-only-code]
---

**Fetch data in a `load(…)` loader and give components plain values. Do not pass database clients, API clients or other objects with methods to components.**

## Why

A component runs on the server, and again in the browser when it is used. What travels from the server to the browser inside the page is data: the route's loader data, signal values, and the props of components that wake up on their own. Data that can be written as text and read back is **serializable**.

- Plain objects, arrays, strings, numbers, dates, `Map` and `Set` travel fine.
- A database client or an API client is a class instance with methods and open connections. It cannot travel. Returned from a loader, the page renders but does not resume ([RV2107](../errors/RV2107.md)). Passed as a prop, it makes the child run together with its parent in the browser, so both components' code loads and the parent builds the client again there.
- A service imported by a page module drags its code (and maybe its secrets) toward the browser. The build keeps `.server.ts` modules out of browser code (a component that uses one fails the build, RV3011), but an ordinary module has no such guard.

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

`ProductApi` and its dependencies now load in the browser, and the browser builds its own client the first time the button is used. On the server, nothing keeps the connection from being opened for every render.

## When to break it

- **Browser-only helpers.** A module that only uses browser APIs (a formatter, a small fetch wrapper) can be imported by handlers directly. The browser builds it again when the component runs there.
- **Context with an id.** Some values (a theme, a locale) are provided to many components. Use context created with an `id` so the browser can provide the same value. See [context](/guides/components/context.md).
