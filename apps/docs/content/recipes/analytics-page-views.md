---
title: Analytics page views
description: Send a page view for the first load and every in-page navigation from the root layout, with the analytics code loaded only when the browser is idle.
template: recipe
related: [guides/state/effects, guides/routing/layouts, guides/performance/preloading, learn/loading-code]
---

## What you will build

A small component that reports page views to an analytics service. It sends one view when the page loads and one after each navigation inside the app. The analytics code is a separate file that loads only when the browser has nothing else to do, so it never slows down the first paint or the first click.

The example uses a stand-in instead of a real service and shows what it sent.

::example{id=analytics-page-views}

## How it works

### 1. Put it in the root layout

```tsx title="src/routes/_layout.tsx"
import { type LayoutProps } from "@rivetjs/router";

export default function Layout({ url, children }: LayoutProps) {
  return (
    <div>
      <main>{children}</main>
      <PageViews url={url} />
    </div>
  );
}
```

The root `_layout.tsx` stays on the page while the router moves between pages. Its `url` prop is an **accessor**: a function that returns the current URL, and that changes on each navigation. Pages get a plain `URL`; only layouts get accessors.

### 2. Send the view from a `clientEffect`

```tsx
import { clientEffect } from "@rivetjs/runtime/dom";

const loadAnalytics = () => import("../analytics.ts");

clientEffect(
  async () => {
    const path = url().pathname;
    const { pageView } = await loadAnalytics();
    pageView(path);
  },
  { when: "idle" },
);
```

- `clientEffect` never runs on the server. In the browser it starts at the moment you choose; `when: "idle"` waits until the browser is idle.
- The effect reads `url()`, so it runs again after each navigation, and sends the new path.
- Read `url()` **before** the first `await`. Rivet tracks the values an effect reads while it runs synchronously. Reads after an `await` are not tracked, so the effect would not run again on navigation.

### 3. Keep the analytics code in its own chunk

`import("../analytics.ts")` is a dynamic import, so the build puts `analytics.ts` in its own file. The browser downloads it only when the effect first runs.

Define `loadAnalytics` at module scope, outside the component. Then the import is not tied to the layout's chunk, and Rivet does not fetch it early together with the layout code.

### 4. A real service

Replace the stand-in with your provider's call, for example:

```ts title="src/analytics.ts"
export function pageView(path: string) {
  navigator.sendBeacon("/api/views", JSON.stringify({ path, referrer: document.referrer }));
}
```

`sendBeacon` delivers the request even if the user leaves the page right away. The `/api/views` URL can be a Rivet [endpoint](/guides/routing/endpoints.md): a plain `.ts` file with an `onPost(…)` export.

## Variations

- **Third-party script.** For a provider that needs its own `<script>` tag, add the tag in `loadAnalytics` (create a `script` element inside the effect) instead of importing a module. Remember to allow its origin in your [Content Security Policy](/guides/security/csp.md).
- **Consent first.** Keep the choice in a cookie or `localStorage`. In the effect, read it and return early when the visitor has not agreed.
- **Other events.** Track clicks with an `onClick` handler that calls the same module.

## Watch out

- **Do not track during server rendering.** The server renders each page once and does not know what the visitor does next. Page views belong in the browser.
- **Development pages differ.** The dev server renders pages differently from production builds (see [dev and production differ](/gotchas/dev-and-production-differ.md)). Check timing in a production build.
- **Do not send personal data in the path.** If URLs can contain emails or tokens, remove them before you send the view.
