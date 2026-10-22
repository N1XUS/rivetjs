---
title: Render with data from another server
description: Let another service post a finished view model to a small Node server, which renders a file route with it through locals and streams the resumable page back.
template: recipe
related: [guides/routing/loading-data, guides/routing/guards, guides/deploy/node, guides/routing/headers-and-caching]
---

## What you will build

A backend you already have (for example an ASP.NET service) owns the business logic. For some pages it has already computed everything the page shows, a complete view model. It only needs Rivet to turn that view model into HTML.

The backend posts JSON to a small Node server: `{ "template": "survey", "viewModel": { … } }`. The Node server renders the file route `/splash/survey` with that view model and streams the resumable page back. The page works in the browser like any other Rivet page.

No side channel is needed (no request id header, no shared map): the server hands the data to the page directly.

## How it works

### 1. The Node server passes the view model as `locals`

The app handler takes a second argument, `context`. Its `locals` member seeds `event.locals` for that one request:

```ts title="server.ts"
import { closeOnSignals, loadBuild, serve } from "@rivetjs/router/node";

// The production build (`vite build` + `vite build --ssr`), loaded as `start()` loads it.
const { handler: app, client } = await loadBuild("dist");

const serving = await serve({
  client,
  handler: async (request, context) => {
    const { template, viewModel } = await request.json();
    const page = new Request(new URL(`/splash/${template}`, request.url), { headers: request.headers });
    return app(page, { ...context, locals: { viewModel } });
  },
});
closeOnSignals(serving);
```

- `loadBuild(dist, config?, options?)` returns the app handler, the client directory and the server entry. `config` takes the `createApp` options `start()` passes on (`csp`, `stream`, `maxBody`, `routeRules`, …); `readManifests(dist)` reads only the client manifests, for a handler you assemble yourself.
- `{ ...context }` keeps what the Node adapter passes: the response's CSP `nonce` and the client `address`.
- The page request is a `GET` for the file route. Guards, loaders and the page render run for it as for any visitor.
- Add `signal: request.signal` to the new `Request` if the render should stop when the backend gives up waiting.

::api{symbol="@rivetjs/router/server#AppHandlerContext"}

::api{symbol="@rivetjs/router/node#loadBuild"}

### 2. The page reads it in its loader

```tsx title="src/routes/splash/survey.tsx"
import { load, type PageProps, type RequestEvent } from "@rivetjs/router";

interface SurveyViewModel {
  title: string;
  questions: { id: string; text: string }[];
}

export const loader = load(({ locals }: RequestEvent) => locals.viewModel as SurveyViewModel);

export default function Survey({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>{data.title}</h1>
      <ol>
        {data.questions.map((question) => (
          <li>{question.text}</li>
        ))}
      </ol>
    </main>
  );
}
```

`event.locals` is the object you pass, not a copy. Request handlers, guards, loaders, actions, `headers(…)` and error pages all see it, and what they write to it is still there when the handler returns: a loader can hand a value back to your server through it (for example `locals.status`). Pass a new object for every request, as above, so one request never sees another's values.

### 3. Only what the loader returns reaches the browser

Seeded values are server-side input. They are not written into the HTML, the resume state or a data answer. The page gets only what its loader returns, like any loader data. If the view model holds fields the page does not show, return a smaller object.

## Variations

- **Locale.** Seed `locals.locale` (and `locals.dir`) to pick the locale variant and its resume manifest, as `i18nGuard` does. A guard that sets them still wins.
- **More than one page.** Map `template` to the route path you render. Check it against a list of known templates, so a request cannot render a route you did not mean to expose.

## Watch out

- **Trust.** Seeded `locals` come only from the code that calls the handler. The Node adapter never fills them from request headers, query or body. Your handler decides what goes in: only put the backend's data there after you checked that the request really comes from your backend (a private network, mTLS or a shared secret).
- **Route cache.** A page rendered with seeded `locals` depends on input that is not in the URL. Requests that pass `locals` skip the [route rules page cache](../guides/routing/headers-and-caching.md) (`swr` / `isr`): they are never served a stored page and never stored. Rule headers still apply. The fragment cache (`cached()`) is not affected.
- **Client navigation.** Links inside the page navigate with data requests (`/splash/survey?_rivet=data`) that go through the same handler. If visitors navigate to such routes in the browser, your handler must seed `locals` for those requests too, or the loader gets no view model. Pages that are only ever rendered this way do not need it.
- **The incoming request is not the page request.** The backend's `POST` and its body are read by your handler. The page sees the new `GET` request and the headers you copied.
