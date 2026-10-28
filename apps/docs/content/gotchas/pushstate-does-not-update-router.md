---
title: pushState does not update the router
description: Why history.pushState changes the address bar but not the page, and how to navigate so the router follows.
template: gotcha
related: [guides/routing/links-and-navigation, guides/routing/file-routes]
---

## What you see

You call `history.pushState` in a handler. The address bar shows the new URL, but the page stays the same. The `url` your layout receives does not change either.

```tsx
<button onClick={() => history.pushState(null, "", "/items/42")}>Show item 42</button>
```

## Why

The browser does not tell anyone when a script calls `history.pushState` or `history.replaceState`. There is no event for it. The router listens only to:

- clicks on links (`<a href>`) to pages of the same site,
- the `popstate` event, which the browser fires for the back and forward buttons,
- its own `navigate` method, and `navigate()` / `setSearchParams()` from `@rivetjs/router/client`.

So a direct `pushState` call changes the address bar behind the router's back.

## Fix

Use a normal link. The router intercepts same-site link clicks, loads the page's data and renders the new page without a full reload. Links also work before any JavaScript has loaded, and with JavaScript turned off.

```tsx
<a href="/items/42">Show item 42</a>
```

`Link` from `@rivetjs/router/client` renders the same plain `<a href>`, with a `to` prop that is checked against your routes. It can also replace the history entry instead of adding one:

```tsx
import { Link } from "@rivetjs/router/client";

<Link to="/items/42">Show item 42</Link>
<Link to="/items/42?tab=reviews" replace>Reviews</Link>
```

For navigation that is not a click on a link (for example after a timer or a save), call `navigate` from `@rivetjs/router/client`. It does what a link click does, without a full reload; `setSearchParams` changes only the query:

```tsx
import { navigate, setSearchParams } from "@rivetjs/router/client";

<button onClick={() => navigate("/items/42")}>Show item 42</button>
<button onClick={() => setSearchParams({ tab: "reviews" })}>Reviews</button>
```

See [navigate from code](../guides/routing/links-and-navigation.md#navigate-from-code).

If you build the router yourself with `createRouter` from `@rivetjs/runtime/router/dom`, call `router.navigate` instead of `pushState`:

```tsx
router.navigate("/items/42"); // push a history entry
router.navigate("/items/42", { replace: true }); // replace the current entry
```

`navigate` accepts only URLs on the same origin, and throws for others.

:::note
Links whose path matches none of the app's page routes (an endpoint, a file in `public/`, a page another app serves on the same domain) skip the router on their own and load the whole page. A link to one of the app's pages that must load the whole page can carry `data-rivet-reload` (or `reload` on `Link`). Links with `download`, a `target` other than `_self`, or `rel="external"` are never intercepted.
:::

Pages in file-routed apps use the exported `navigate()` helper; they do not need a router instance as a prop. Use `location.assign` when you want a full document load.
