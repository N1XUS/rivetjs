---
title: Handle errors where they happen
description: Throw HTTP errors from server code, render them with _404 and _error pages, log server failures with their digest and catch browser failures in handlers.
template: best-practice
related: [guides/routing/errors-and-404, guides/components/async, recipes/optimistic-like, guides/deploy/node]
---

**On the server, throw an HTTP error with the right status and let `_404.tsx` and `_error.tsx` render it. In the browser, catch failures inside the handler that caused them and tell the user.**

## Why

- **The right status code.** A missing product should answer 404, not 200 with "not found" text. Search engines, caches and monitoring rely on the status.
- **One place to render.** `_404.tsx` and `_error.tsx` render every failure in their folder, so pages stay about the happy path.
- **Safe messages.** For 4xx errors the message you pass is shown to the user. For 5xx errors a production server shows only "Internal Server Error (digest …)". The real error stays in your server log, under the same short digest, so you can find it.
- **Browser code fails differently.** A `fetch` in a handler can fail long after the page rendered. Only the handler knows what the user was doing, so it is the right place to undo and explain.

## Do

```tsx title="src/routes/products/[id].tsx" prefer group="routes"
import { error, notFound, type PageProps, type RequestEvent, load } from "@rivetjs/router";
import { findProduct } from "../../db.server.ts";

export const loader = load(async ({ params }: RequestEvent<"products/[id]">) => {
  const product = await findProduct(params.id);
  if (!product) throw notFound(`No product ${params.id}`);
  if (product.hidden) throw error(410, "This product was removed");
  return product;
});

export default function Product({ data }: PageProps<typeof loader>) {
  return <h1>{data.name}</h1>;
}
```

```tsx title="src/routes/_error.tsx" prefer group="routes"
import { isHttpError } from "@rivetjs/router";

export default function Failure({ error }: { error: unknown }) {
  return (
    <main>
      <h1>Something went wrong</h1>
      <p>{isHttpError(error) && error.expose ? error.message : "Please try again later."}</p>
    </main>
  );
}
```

Log server failures in one place, when you start the server:

```js title="serve.js" prefer
const serving = await start({ dist: "dist", onError: (error, request) => logger.error({ error, url: request?.url }) });
```

In the browser, catch the failure in the handler and show it:

```tsx prefer
onClick={async () => {
  try {
    const response = await fetch("/api/save", { method: "POST", body });
    if (!response.ok) throw new Error("HTTP " + response.status);
    message.set("Saved.");
  } catch {
    message.set("Could not save. Check your connection and try again.");
  }
}}
```

## Don't

```ts avoid
import { load } from "@rivetjs/router";
export const loader = load(async ({ params }: RequestEvent<"products/[id]">) => {
  try {
    return { product: await findProduct(params.id), error: null };
  } catch (cause) {
    // Status 200, and the database message goes to the browser.
    return { product: null, error: String(cause) };
  }
});
```

## When to break it

- **Expected, partial failures.** If one box on a dashboard cannot load, the rest of the page is still useful. Return `null` for that part (and show "not available"), or load it in an `<Async>` boundary with an `error` view.
- **Form validation.** A wrong input is not an error page. Return `fail(400, data)` from the action and show the messages next to the fields. See the [login form](/recipes/login-form.md) recipe.
- **Code that fails to load.** If a chunk cannot be fetched (twice), Rivet dispatches `rivet:resume-error` on `document` and reloads the page. Call `event.preventDefault()` in a listener to show your own message instead.
