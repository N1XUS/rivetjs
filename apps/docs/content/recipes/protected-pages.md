---
title: Protected pages
description: Protect a whole folder of pages with one guard in a layout file, redirect signed-out visitors and keep private pages out of shared caches.
template: recipe
related: [recipes/login-form, guides/routing/guards, guides/routing/layouts, guides/routing/headers-and-caching]
---

## What you will build

Two private pages, `/dashboard` and `/settings`, and a public home page. A visitor who is not signed in and opens a private page goes to `/login?next=/dashboard`. After signing in, they come back to the page they asked for.

One file protects all private pages. A new page in the same folder is protected without any extra code.

The example needs a server (guards read cookies), so it is shown as code. Copy it into the server starter to try it.

::example{id=protected-pages}

## How it works

### 1. Group the private pages in a folder

```txt
src/routes/
  index.tsx               → /
  login.tsx               → /login
  (app)/
    _layout.tsx           → guard for everything in (app)
    dashboard.tsx         → /dashboard
    settings.tsx          → /settings
```

A folder name in parentheses, like `(app)`, is a **group**. It adds nothing to the URL: the page is `/dashboard`, not `/app/dashboard`. Groups exist to share a layout or a guard.

The group's `_layout.tsx` holds the server part (the guard). Its component only renders `children`, so it adds no extra markup.

### 2. The guard runs before every page in the group

```tsx title="src/routes/(app)/_layout.tsx"
import { redirect, type LayoutProps, type RequestEvent, guard } from "@rivetjs/router";
import { userFrom } from "../../session.server.ts"; // used only by the guard

export const access = guard(({ cookies, url, locals }: RequestEvent) => {
  const user = userFrom(cookies);
  if (!user) return redirect("/login?next=" + encodeURIComponent(url.pathname + url.search));
  locals.user = user;
});

export default function AppLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
```

- Return nothing to let the request continue.
- Return (or throw) `redirect(...)`, `deny()` or `notFound()` to stop it. The page's loader then never runs.
- Guards run from the outermost layout inwards, then the page's own guard.

The guard also runs when the Rivet router navigates in the page, not only on full page loads. In-page navigation asks the server for the next page's data, and the server runs the same guards. If the session has ended, the router follows the redirect to the sign-in page.

### 3. Pass the user to the page through `locals`

`locals` is an object shared by everything that handles one request. The guard puts the user there, and the page's loader reads it:

```tsx title="src/routes/(app)/dashboard.tsx"
import { type RequestEvent, type PageProps } from "@rivetjs/router";

import { load } from "@rivetjs/router";
export const loader = load(({ locals }: RequestEvent) => ({ name: (locals.user as User).name }));

export default function Dashboard({ data }: PageProps<typeof loader>) {
  return <h1>Hello, {data.name}</h1>;
}
```

Return only what the page shows. Everything a loader returns is sent to the browser.

### 4. Keep private pages out of shared caches

```tsx
import { headers } from "@rivetjs/router";
export const responseHeaders = headers(() => ({ "cache-control": "private, no-store" }));
```

`headers(…)` in the same layout file adds this header to every page in the group. A CDN or proxy will not store one user's dashboard and show it to someone else.

### 5. Send the user back after sign-in

The guard puts the current path in `next`. The login page keeps it in a hidden field, and the login action redirects there. The action only accepts paths on your own site, so the link cannot send users to another website. The [login form](./login-form.md) recipe explains this check.

## Variations

- **Roles.** Store a role on the user and check it in a nested group: the `guard(…)` in `(app)/(admin)/_layout.tsx` returns `deny()` (403) for non-admins.
- **API endpoints.** Endpoint files (plain `.ts` files with `onGet(…)`, `onPost(…)` exports) inside the group are protected by the same guard.
- **Different sign-in page per area.** Each group can redirect to its own page.

## Watch out

- **Hiding a link is not protection.** Only the server guard keeps a page private. Always check on the server.
- **Check again in actions.** A guard protects the page and its actions. If an action changes data, also check that this user may change this item.
- **Static builds have no guards.** Prerendered pages are files; nothing runs per request. Protected pages need a server app.
- **The demo signs in without a password.** Use the [login form](./login-form.md) recipe for real sign-in.
