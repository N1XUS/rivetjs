---
title: Streaming
description: Send the page before slow data is ready, with a fallback that the server replaces later in the same response.
template: guide
status: experimental
related: [guides/components/async, guides/routing/loading-data, guides/deploy/node, guides/performance/measuring]
---

Some parts of a page wait for slow data, such as recommendations or a third-party API. Without streaming, the server waits for all of it before it sends anything. With :term[streaming]{id=streaming}, the server sends the page at once with a placeholder in the slow part. When the data arrives, the server sends the finished part in the same response, and the browser puts it in place.

After reading this page you can turn on streaming, mark the parts that may stream, and set a time limit.

## Turn it on

Streaming is off by default. With the Node adapter, pass `stream` to `start`:

```ts title="serve.js"
import { closeOnSignals, start } from "@rivetjs/router/node";

const serving = await start({ dist: "dist", stream: { deadline: 3000 } });
closeOnSignals(serving);
```

`deadline` is optional. It is the number of milliseconds, from the start of rendering, after which the server stops waiting. It has no default; without it, the server waits until every part is done.

Without the router, pass the same option to `renderResumable` from `@rivetjs/runtime/server-resume`: `renderResumable(() => <Page />, writer, { manifest, stream: { deadline: 3000 } })`.

## Mark the slow part

A part streams when it is an `Async` with a `fallback`, and its `load` returns a promise that is still pending:

```tsx title="src/routes/products/[id].tsx"
import { Async, For } from "@rivetjs/runtime/dom";
import type { PageProps } from "@rivetjs/router";

type Review = { id: string; text: string };

const loadReviews = (id: string) =>
  fetch(`https://reviews.example.com/products/${id}`).then((r) => r.json() as Promise<Review[]>);

export default function Product({ data, params }: PageProps<{ name: string }, { id: string }>) {
  return (
    <main>
      <h1>{data.name}</h1>
      <Async load={() => loadReviews(params.id)} fallback={() => <p>Loading reviews…</p>}>
        {(reviews) => (
          <ul>
            <For each={() => reviews} by={(review) => review.id}>
              {(review) => <li>{review().text}</li>}
            </For>
          </ul>
        )}
      </Async>
    </main>
  );
}
```

The heading goes out right away with "Loading reviews…". The list follows when `loadReviews` finishes. A `lazyComponent` with a `fallback` streams the same way.

An `Async` without `fallback` is awaited as before: the server waits for it before sending that part.

To stream several parts as one piece, wrap them in a [`Suspense`](../components/suspense.md) with a `fallback`: the parts inside never stream one by one, and the whole content arrives together once all of them are ready.

## What the browser receives

1. The page with the fallback in place, and a small extra script (about 700 bytes compressed) that only streaming pages get.
2. Later in the same response, one piece per finished part: the HTML and the state it needs. Pieces arrive in the order they finish.
3. The browser swaps the fallback for the finished HTML. Event handlers in the new part work like the rest of the page.

You do not write any browser code for this.

## When the data is late or fails

The browser takes over a part, and loads it itself, when:

- the `deadline` passes before the part is done,
- the `load` fails and the `Async` has no `error` handler,
- the response ends while the part is still pending.

In those cases the browser runs the `Async` again and calls `load` in the browser. So `load` must work in the browser too: use `fetch` to a public URL, not a server-only module.

If the visitor leaves the page, the server stops writing.

## Loader data versus streaming

Route loaders (`load(…)`) finish before the page renders. They never stream. Use them for data the page cannot show without. Use a streamed `Async` for parts that can appear a moment later. See [Loading data](../routing/loading-data.md).

## Make sure the response is really streamed

The Node adapter sends a page in one piece when it is complete before the next event-loop turn. A large uncompressed page sends its first part (the document head) at once and the rest when it is rendered. A page that is still waiting streams, and compressed responses are flushed after every piece.

Proxies and CDNs in front of your server can buffer the whole response. Then the visitor sees nothing until everything is done. Check your proxy settings for response buffering.

To check streaming, open the page with the network panel open and look at the timing of the document request: the content download takes as long as the slowest part. See [Measuring](measuring.md).

## Limits

- Only an `Async` that has its own place in the page streams. An `Async` inside a list row, or nested in another `Async` of the same component, is awaited instead.
- Prefetching for handlers in the first part does not include code for bindings that arrive later. That code loads when it is needed.
- Dev pages render in the browser, so they do not stream. Test streaming with a production build.

## See also

- [Async](../components/async.md)
- [Loading data](../routing/loading-data.md)
- [Node](../deploy/node.md)
