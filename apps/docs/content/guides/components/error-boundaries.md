---
title: Error boundaries
description: Catch errors of one part of the page with ErrorBoundary, show a fallback with a retry, and know what it catches on the server and in the browser.
template: guide
status: experimental
related: [guides/routing/errors-and-404, best-practices/error-handling, guides/components/async]
---

A route's `_error.tsx` replaces the whole page when something fails. `ErrorBoundary` is for smaller failures: one widget breaks, shows a message and a retry button, and the rest of the page keeps working. After reading this page you can wrap a part of the page in a boundary, reset it, and you know which errors it catches.

::example{id=error-boundary}

## Wrap a part of the page

Import `ErrorBoundary` from `@rivetjs/runtime/dom`. `fallback` gets the error and a `reset` function:

```tsx check
import { ErrorBoundary } from "@rivetjs/runtime/dom";

function Chart(props: { points: number[] }) {
  if (props.points.length === 0) throw new Error("No data to draw");
  return <p>{props.points.length} points</p>;
}

export function Dashboard(props: { points: number[] }) {
  return (
    <section>
      <h2>Sales</h2>
      <ErrorBoundary fallback={(error, reset) => <p role="alert">Could not show the chart. <button onClick={() => reset()}>Try again</button></p>}>
        <Chart points={props.points} />
      </ErrorBoundary>
    </section>
  );
}
```

- `fallback(error, reset)` renders instead of the children once something inside failed. The first error wins until the boundary is reset.
- `reset()` removes the fallback and renders the children again, from scratch. Change the state that caused the error first (as the example does), or the children fail again.
- The compiler passes the children as a function, so they are created inside the boundary. Plain JSX children work.

::api{symbol="@rivetjs/runtime/dom#ErrorBoundary"}

## What it catches

| Error | Caught |
| --- | --- |
| A component inside throws while it renders | yes |
| An effect or a JSX binding inside throws, also when a handler's write triggered it | yes |
| An `Async` inside fails and has no `error` prop of its own | yes |
| The event handler itself throws (`onClick={() => { throw … }}`) | no: the error goes to the console (`reportError`), as with any listener |
| The fallback throws | no: the next boundary up handles it |

Catch errors of a handler in the handler, with `try`/`catch`, and write the message into a signal.

## On the server

A boundary works during server rendering too. When its children throw, the server writes the fallback into the HTML instead, and the rest of the page renders as usual. The error does not reach the route's `_error.tsx`.

`reset` works on a resumed page: clicking "Try again" in a server-rendered fallback renders the children in the browser. The example on this page starts this way.

On a resumed page, the boundary also catches content that the server rendered successfully: when one of its bindings fails after a later signal change, the browser renders the boundary again and shows the fallback, as on a page the browser rendered.

With [streaming](../performance/streaming.md), a part inside the boundary that fails after the first bytes were sent becomes the boundary's fallback in a later chunk of the same response.

## Common mistakes

- **Expecting a boundary to catch handler errors.** It catches rendering, effects and bindings. Use `try`/`catch` in the handler.
- **Calling `reset()` without fixing the cause.** The children render again with the same state and fail again.
- **Using a boundary for missing data.** A missing record is a 404: throw `notFound()` in the route's `serverLoad`. See [errors and 404 pages](../routing/errors-and-404.md).


## See also

- [Errors and 404 pages](../routing/errors-and-404.md): route-level error pages.
- [Error handling](../../best-practices/error-handling.md)
- [Async](./async.md): the `error` prop of a single loading part.
