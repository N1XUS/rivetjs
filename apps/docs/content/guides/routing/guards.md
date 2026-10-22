---
title: Guards
description: Protect pages with a guard(…) export that runs on the server before any loader, and redirect or refuse visitors who may not see the page.
template: guide
related: [guides/routing/layouts, guides/routing/actions-and-forms, recipes/protected-pages, recipes/login-form]
---

A **guard** decides if a request may continue. It runs on the server before any loader, for the first page load and for every client navigation. After reading this page you can protect one page or a whole folder, send visitors to a login page, and pass the signed-in user on to loaders.

::example{id=guard-login}

## Write a guard

Export `guard(…)` from the page file. Return nothing to let the request through. Return (or throw) a redirect or a denial to stop it:

```tsx title="src/routes/settings.tsx"
import { redirect, type RequestEvent, guard } from "@rivetjs/router";

export const access = guard(({ cookies }: RequestEvent) => {
  if (!cookies.get("session")) return redirect("/login");
});

export default function Settings() {
  return <h1>Settings</h1>;
}
```

Without a `session` cookie, the visitor gets a `302` redirect to `/login`, and the page's loader never runs. `guard(…)` runs only on the server; the compiler removes it from the browser build.

## Protect a whole folder

A `guard(…)` in `_layout.tsx` runs for every page **and** [endpoint](./endpoints.md) inside that folder. A group folder lets you protect pages without changing their URLs:

```txt
src/routes/
  login.tsx
  (private)/
    _layout.tsx         ← guard(…) export here protects everything below
    account.tsx         → /account
    orders.tsx          → /orders
```

The layout component can simply render its `children`.

## Order and the `locals` object

For one request, guards run one after another, from the outermost layout to the page. The first guard that returns a result stops the chain. Only when all guards pass do the loaders run, all at the same time.

Use `locals` to hand information down the chain, so you check the session once:

```tsx title="src/routes/(private)/_layout.tsx"
import { redirect, type LayoutProps, type RequestEvent, guard } from "@rivetjs/router";
import { userForSession } from "../../sessions.server.ts";

export const access = guard(async ({ cookies, url, locals }: RequestEvent) => {
  const user = await userForSession(cookies.get("session"));
  if (!user) return redirect("/login?next=" + encodeURIComponent(url.pathname));
  locals.user = user;
});

export default function Private({ children }: LayoutProps) {
  return <>{children}</>;
}
```

```tsx title="src/routes/(private)/account.tsx"
import type { PageProps, RequestEvent } from "@rivetjs/router";
import { load } from "@rivetjs/router";

export const loader = load(({ locals }: RequestEvent) => {
  const user = locals.user as { name: string };
  return { name: user.name };
});

export default function Account({ data }: PageProps<typeof loader>) {
  return <h1>Hello, {data.name}</h1>;
}
```

`locals` is a plain object, new for every request. It starts empty, or is the very object the code that calls the app handler passed as `context.locals` (not a copy) (see [render with data from another server](../../recipes/render-with-data-from-another-server.md)). Its type is `Record<string, unknown>`, so cast when you read it.

## Ways to stop a request

| Result | Response |
| --- | --- |
| `undefined` (no return) | The request continues. |
| `redirect(url)` | `302` with `Location: url`. Pass a second argument for `301`, `303`, `307` or `308`. |
| `deny()` | `403 Forbidden`, rendered with the nearest `_error.tsx`. |
| `deny(401)` | `401 Unauthorized`. |
| `notFound()` | `404`, rendered with the nearest `_404.tsx`. Use it to hide that a page exists. |
| `error(status, message)` | Any 4xx or 5xx status, rendered with `_error.tsx`. |
| a `Response` | Sent as it is. |

You can `return` or `throw` these in a guard; both work.

::api{symbol="@rivetjs/router#redirect"}

## Guards and client navigation

When the user clicks a link, the browser fetches the next page's data from the server. The server runs the guards for that request too. If a guard redirects, the router follows the redirect in the browser and replaces the history entry, so the back button does not return to the blocked page. You never need to repeat a guard check in browser code.

## Cookies

`cookies.get(name)` reads a cookie from the request. `cookies.set(name, value, options)` and `cookies.delete(name)` add `Set-Cookie` headers to the response. The defaults are safe:

| Option | Default |
| --- | --- |
| `path` | `"/"` |
| `httpOnly` | `true` (scripts cannot read the cookie) |
| `secure` | `true` (sent over HTTPS only; most browsers also accept it on `http://localhost`) |
| `sameSite` | `"lax"` |

Set `maxAge` (seconds) or `expires` for a cookie that outlives the browser session. Set cookies in actions (after a login form, for example) rather than in guards.

::api{symbol="@rivetjs/router/server#Cookies"}

## The visitor's IP address

`event.platform.clientAddress` is the visitor's IP address, when the adapter knows it: the Node adapter sets it from the connection (behind a proxy, from `X-Forwarded-For` with `trustProxy: true`; see [behind a proxy](../deploy/node.md#behind-a-proxy)). The fetch adapter for edge platforms sets it with its `address` option, for example `address: (request) => request.headers.get("cf-connecting-ip") ?? undefined`. It is `undefined` in static builds and when the adapter cannot tell.

On the Node adapter, `event.platform.node` also holds the raw Node request and response (`{ req, res }`) for what the web `Request` does not carry: the request target as sent (`req.url`), repeated headers (`req.rawHeaders`), the client port (`req.socket.remotePort`). Read from them; answer with a `Response`.

```ts title="src/routes/login.tsx"
import type { RequestEvent } from "@rivetjs/router";
import { error, guard } from "@rivetjs/router";
import { tooManyAttempts } from "../rate-limit.server.ts";

export const access = guard(({ platform }: RequestEvent) => {
  if (platform.clientAddress && tooManyAttempts(platform.clientAddress)) return error(429, "Too many attempts");
});
```

## Guards in static sites

In `mode: "static"`, guards run once during the build, with no visitor and no cookies. They cannot protect anything per visitor. Use a server app for pages that need a login.

## Common mistakes

- **Checking access only in the page component.** The component's output can be hidden, but the loader already ran and its data is in the page. Check in a guard.
- **Redirecting to the `next` URL without checking it.** `?next=https://evil.example` would send people to another site. Accept only paths that start with a single `/`.
- **Redirecting to a page that the same guard protects.** `/login` inside `(private)/` loops forever. Keep the login page outside the protected folder.
- **Expecting a `guard(…)` in `_404.tsx` to run.** Only pages, layouts and endpoints run server code.

## See also

- [Protected pages recipe](/recipes/protected-pages.md)
- [Login form recipe](/recipes/login-form.md)
- [Actions and forms](./actions-and-forms.md)
- [Layouts](./layouts.md)
