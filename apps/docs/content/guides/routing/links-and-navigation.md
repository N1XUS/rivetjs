---
title: Links and navigation
description: Link pages with plain anchors or the typed Link component, control prefetching, scroll and focus, and react to navigations in your own code.
template: guide
related: [guides/routing/transitions, guides/routing/typed-routes, best-practices/links-and-forms-without-js, gotchas/pushstate-does-not-update-router]
---

In a Rivet app, a link is an `<a href>`. Before any JavaScript loads, it works like on any website. Once the router is active, a click on a link to another page of your app no longer loads a full new document: the router fetches only the next page's data and code, swaps the page, and keeps your root layout in place. After reading this page you can write links, choose when the router steps in, and react to navigations.

::example{id=links-navigation}

## Write links

Use normal anchors:

```tsx title="src/routes/_layout.tsx"
import type { LayoutProps } from "@rivetjs/router";

export default function Layout({ children }: LayoutProps) {
  return (
    <div>
      <nav>
        <a href="/">Home</a>
        <a href="/items/42">Item 42</a>
        <a href="/about#team">Our team</a>
      </nav>
      <main>{children}</main>
    </div>
  );
}
```

You do not register click handlers. The router listens for clicks on the whole document and handles every link that qualifies.

## Use `<Link>` for typed links

`<Link>` renders the same plain `<a href>`, with two extras: TypeScript checks `to` against your pages (see [typed routes](./typed-routes.md)), and its props set the router's options for this link.

```tsx
import { Link } from "@rivetjs/router/link";

<Link to="/">Home</Link>;
<Link to={`/items/${item.id}`} pending="opacity-60">{item.title}</Link>;
<Link to="/settings" replace prefetch="none">Settings</Link>;
<Link to="/export.csv">Download CSV</Link>;
<Link to="/account" reload>Account</Link>;
```

| Prop | Effect | Same as on `<a>` |
| --- | --- | --- |
| `to` | Target page, typed as `LinkHref`. | `href` |
| `prefetch="none"` | Load data and code only on click, not on hover. | `data-rivet-prefetch="none"` |
| `prefetch="document"` / `"prerender"` | For a link that loads a document (a path no page route matches, or `reload`): the browser fetches (or prerenders) the page before the click. | `data-rivet-prefetch="document"` |
| `replace` | Replace the current history entry instead of adding one. | `data-rivet-replace` |
| `reload` | Full page load, no client navigation, even when the path matches a page. | `data-rivet-reload` |
| `transition` | Animation types for this navigation, or `false` for none. | `data-transition` |
| `pending` | Classes added while this link's page loads. | `data-rivet-pending-class` |

`transition` and `pending` need [route transitions](./transitions.md) turned on. `<Link>` also passes `class`, `id`, `title`, `rel`, `target`, `aria-label` and `aria-current`. It has no other attributes; use a plain `<a>` with the `data-` attributes from the table when you need more. Both behave the same. `Link` is also exported from `@rivetjs/router/client`.

::api{symbol="@rivetjs/router/link#Link"}

### Under a base path

When the app is served under a base path (`rivetRouter({ base: "/shop" })`), a plain `<a href>` must include it: `<a href="/shop/items/42">`. A link to `/items/42` is outside the app, so it loads that document, usually your server's 404. `<Link to="/items/42">` and `navigate("/items/42")` add the base for you; for a plain anchor, `withBase("/items/42")` from `@rivetjs/router` does (`<a href={withBase("/items/42")}>`, as in the example above).

## Which links the router handles

The router takes over a click only when all of these hold:

- the link points to the same origin, over `http:` or `https:`;
- its path matches one of the app's page routes (after the base path) that is not a document route;
- it has no `download` attribute, no `data-rivet-reload`, no `target` other than `_self`, and no `rel="external"`;
- it is a plain left click, without :kbd[Ctrl], :kbd[Shift], :kbd[Alt] or :kbd[Cmd] (so "open in new tab" keeps working);
- no other handler called `event.preventDefault()`.

A link to an anchor on the same page (`#team`) keeps the browser's own behaviour. Everything else (other sites, files, `mailto:`) is untouched.

A link whose path matches no page route loads its document, with no data request and no prefetch of page code on hover: an endpoint (`/export.csv`, `/api/…`), a file in `public/`, a page served by another app on the same origin. The router checks this against its own route table, including dynamic, optional and catch-all segments. An app with a root catch-all page (`[...path].tsx`) routes every path. An endpoint that a dynamic page pattern would also fit (`items/export.ts` next to `items/[id].tsx`) is still an endpoint: the server answers it first, and so does the router.

Use `data-rivet-reload` (or `<Link reload>`) when a page of this app must load as a whole document, for example after a sign-in that changes the layout:

```tsx
<a href="/account" data-rivet-reload="">Account</a>
```

**Document routes** load as whole documents without the attribute: pages that use a server-only module themselves (see [server-only code](../security/server-only-code.md#what-the-build-checks)) or `import "@rivetjs/router/server-only"`. The browser has no code for them, so the router leaves every link to them to the browser.

`navigate()` and the back and forward buttons do not check `data-rivet-reload`: they always render through the router, so a URL with no page shows your 404 page. For a document route they load its document.

## What happens on a click

1. The router adds a history entry (or replaces it) and updates the URL right away.
2. It fetches the new page's data from the server and its code, in parallel. Guards and loaders run on the server as usual.
3. When both are ready, it swaps the page in one step. Until then, the old page stays visible and keeps working.
4. It sets `document.title` from the new page's `head`.
5. It scrolls to the top, or to the element named in `#hash`, and moves keyboard focus to the page's first `<h1>` (inside `<main>` if there is one), so screen readers announce the new page.

Back and forward buttons restore the scroll position you had on that page.

If rendering the new page throws after the URL changed (a bug in the page, a module the browser cannot use), the router loads that URL's document instead, so the URL and the page never disagree. It does this at most once per URL within 10 seconds, so a page whose document fails too does not reload forever. In development the error overlay shows the error first.

## Prefetching on hover

When the pointer moves over a link, or the link gets keyboard focus, the router starts loading that page's code and data. A click within 5 seconds reuses the data, so the page often appears at once. Turn this off for one link with `prefetch="none"` (`data-rivet-prefetch="none"`), for example for links whose loader is expensive.

Links that load a whole document (a path no page route matches, `reload`, or every link in an app with one page) can be prefetched too, by the browser: `prefetch="document"` fetches the next page's HTML on hover, `prefetch="prerender"` renders it in the background. Set a default for the whole app with `rivetRouter({ prefetch: "document" })`. See [instant page transitions](../../recipes/instant-page-transitions.md).

## Navigate from code

`navigate(to, options?)` from `@rivetjs/router/client` does what a link click does: it asks `beforeLeave` guards, sends `rivet:navigate`, loads the page's data and code, swaps the page, moves focus and scroll. It returns a promise that resolves when the new page is in.

```tsx title="src/routes/account.tsx"
import { navigate } from "@rivetjs/router/client";

export default function Account() {
  const logOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    await navigate("/", { replace: true });
  };
  return <button onClick={logOut}>Log out</button>;
}
```

Prefer a link when the user picks where to go: links work without JavaScript and open in new tabs. `navigate()` is for navigations that follow other work, like the one above.

- Options: `replace` (no new history entry), `state` (keys merged into `history.state`), `scroll: false` (keep the position), `focus: false` (leave focus alone), `transition` (view transition types, or `false`).
- A URL on another origin loads that document (`location.assign`).
- `invalidate()` (alias `revalidate()`) runs the current page's loaders again without a new history entry, for example after a change from another tab. `invalidate("cart")` reruns only loaders that called `event.depends("cart")`.

After a form submit, let the server answer with a [redirect](./actions-and-forms.md#redirect-after-the-change).

Do not call `history.pushState()` yourself. The router does not see it, and the page does not change. See [pushState does not update the router](/gotchas/pushstate-does-not-update-router.md).

## Search params

`useSearchParams()` returns a function that reads the shown page's `URLSearchParams`. It updates when a navigation commits, and works in layouts too. `setSearchParams(update)` navigates to the same path with a new query; it keeps scroll and focus.

```tsx title="src/routes/products.tsx"
import { setSearchParams, useSearchParams } from "@rivetjs/router/client";

export default function Products() {
  const search = useSearchParams();
  return (
    <p>
      Sorted by {search().get("sort") ?? "name"}.
      <button onClick={() => setSearchParams((params) => void params.set("sort", "price"))}>Sort by price</button>
    </p>
  );
}
```

- Call `useSearchParams()` while the component is set up, not inside a handler. Treat the value as read-only.
- `update` is a `URLSearchParams`, a plain object, or a function that gets a copy of the current params and changes it (or returns new ones). The hash is dropped.
- A new query is a navigation: the route's loaders run again and the page renders again. Root layout state stays.
- Apps that never call `useSearchParams()` ship none of its code.

## Warn before leaving

`beforeLeave(fn)` from `@rivetjs/router/client` runs `fn` before the user leaves the page: a link click, `navigate()` or `setSearchParams()` (`leave.type === "link"`), back or forward (`"history"`), and reload, closing the tab or a full page load (`"unload"`). Call `leave.cancel()` to stay. It returns a function that removes the guard; register it in a `clientEffect`, so the guard goes away with the component:

```tsx title="src/routes/editor.tsx"
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { beforeLeave } from "@rivetjs/router/client";

export default function Editor() {
  const dirty = signal(false);
  clientEffect(() =>
    beforeLeave((leave) => {
      if (dirty() && (leave.type === "unload" || !confirm("Leave without saving?"))) leave.cancel();
    }),
  );
  return <textarea onInput={() => dirty.set(true)} />;
}
```

- On `"unload"` the browser shows its own question; your text is not shown, so do not call `confirm()` there.
- A cancelled back or forward moves history back to the page you are on.
- Changes to the `#hash` only, redirects and `invalidate()` are not guarded.
- While a guard is registered, the browser keeps the page out of its back/forward cache. Remove the guard when nothing is unsaved.
- `@rivetjs/forms/autosave` has `guardLeave(auto)`, the same guard for an autosaved form.

## React to navigations

The router sends events on `document`, which you can listen to with `clientEvent` or in a `clientEffect`:

| Event | When | Notes |
| --- | --- | --- |
| `rivet:navigate` | A link click starts a navigation. | Cancelable: `event.preventDefault()` keeps the current page. |
| `rivet:before-swap` | Data and code are ready, before the swap. | Needs transitions. |
| `rivet:after-swap` | The new page is in the document. | Needs transitions. |
| `rivet:navigated` | The navigation (and its animation) finished. | Needs transitions. |

`event.detail` holds `{ from, to, type, trigger }`: the URLs, `"push"`, `"replace"`, `"back"` or `"forward"`, and what started it (`"link"`, `"popstate"`, `"redirect"`, `"api"`).

For example, cancel a link click from a handler (this covers link clicks only; the back button and closing the tab do not send `rivet:navigate`; [`beforeLeave`](#warn-before-leaving) covers all three):

```tsx title="src/routes/editor.tsx"
import { signal } from "@rivetjs/reactivity";
import { clientEvent } from "@rivetjs/runtime/dom";

export default function Editor() {
  const dirty = signal(false);
  // To cancel, the handler must run at once: load its code with the page ("eager").
  clientEvent(
    document,
    "rivet:navigate",
    (event: Event) => {
      if (dirty() && !confirm("Leave without saving?")) event.preventDefault();
    },
    { preload: "eager" },
  );
  return <textarea onInput={() => dirty.set(true)} />;
}
```

`onNavigate(fn)` from `@rivetjs/router/client` calls `fn` at the start of every client navigation, including back and forward. If `fn` returns a function, that runs once the new page is in. It returns a function that stops listening.

::api{symbol="@rivetjs/router/client#onNavigate"}

## Show that a page is loading

`useNavigation()` from `@rivetjs/router/client` returns the navigation state: `state` (`"idle"` or `"loading"`), `location` (where the user is going), `from`, `type` and `shown`. With [route transitions](./transitions.md) turned on, it updates during each navigation; without them it stays idle. The transitions page shows a loading indicator built with it.

## Trailing slashes

By default `/about` and `/about/` show the same page and the URL stays as the visitor typed it. To keep one form (for search engines and caches), set `rivetRouter({ trailingSlash: "never" })` (`/about`) or `"always"` (`/about/`):

- A page request for the other form gets a `308` redirect to the chosen one; the query string is kept. Endpoints and form posts are never redirected.
- `<Link to="/about">` and `navigate("/about")` write the chosen form, so clicks need no redirect.
- Static builds write `about.html` with `"never"` and `about/index.html` otherwise, matching how static hosts serve each form.

The home page `/` never changes.

## Common mistakes

- **A `<button>` with `onClick` that changes the URL.** Use a link. Links work without JavaScript, can open in a new tab, and are followed by search engines. See [links and forms without JavaScript](/best-practices/links-and-forms-without-js.md).
- **Expecting state in a nested layout or page to survive a click.** Only the root layout stays mounted. See [layouts](./layouts.md#root-layout-state-survives-navigation).
- **Plain links without the base path.** Under `rivetRouter({ base })`, `<a href="/about">` leaves the app. Use `<Link to="/about">` or `href={withBase("/about")}`.
- **Reading `useSearchParams()` in a handler.** Call it while the component is set up and keep the function; read `search()` in the handler or binding.
- **Calling `navigate()` with the URL of an endpoint or a page outside the app.** `navigate()` always renders through the router and shows your 404 page. Use a link, or `location.assign(url)`.

## See also

- [Route transitions](./transitions.md)
- [Typed routes](./typed-routes.md)
- [Layouts](./layouts.md)
