---
title: Dev and production differ
description: Dev pages resume like production until you edit a file; what still differs (bundling, development checks), and how to test the real behaviour.
template: gotcha
related: [learn/resuming, guides/tooling/dev-server-and-hot-reload, guides/tooling/vite]
---

## What you see

Something works with `npm run dev` but not after `npm run build`, or the other way round. Typical cases:

- After you saved a file, components run in the browser (a top-level `console.log` prints there), and the counter you clicked is back at 0.
- In dev, the browser loads many small modules. In production it loads a few bundled chunks.
- A page in a non-default locale (i18n) renders in the browser in dev even before any edit.

## Why

In production, the page :term[resumes]{id=resumability}. The server renders the HTML and writes the page state into it. The browser runs a small loader and fetches the code for a button only when you use it. Components do not run in the browser.

The dev server does the same on page load: the same HTML, state and loader, and the code of a button loads when you use it (one file per component, served by Vite). Serialization errors (`function is not serializable`) show in the error overlay, with the component and line.

What differs:

- **After your first edit**, the page switches to rendering in the browser, so :term[hot reload]{id=hot-reload} can swap components in place. Signals of the resumed page start fresh at that moment; from then on, edits keep state. Reload the page to resume again.
- Code is not bundled or minified. Chunks are per component (the default `chunks: "route"` grouping and `"group"` apply only in builds), and per-component `preload` settings and lazy-page prefetch lists apply only in builds.
- Pages in a non-default i18n locale render in the browser, as with `dev: { resume: false }`.
- **Development checks.** Dev and production compile components to the same DOM code (cloned templates, delegated events). In dev the runtime adds checks on top: a warning when a dynamic style value is dropped (for example one with `url(`), and serialization errors that name the capture and the path of the bad value (``capture `items` .items[2].onClick``). Production builds leave the checks out, so they are smaller and a little faster.
- **Data class instances are checked more strictly in dev.** In dev the server refuses an instance whose own state would not come back exactly as it is: a frozen or sealed instance, a getter / setter or read-only field defined on the instance, a symbol key, or a non-enumerable field (``Shape instance is not serializable: an accessor `g` does not resume``). A production build resumes such an instance anyway, with its enumerable fields as plain writable data: symbol keys and non-enumerable fields are dropped, and the object is no longer frozen. Keep such state out of the instance (plain fields only), or create the object inside the handler.

## Fix

Use dev for fast editing. Check speed and bundle size in a production build:

```bash
npm run build   # vite build && vite build --ssr  (static starter: also prerenders)
npm start       # server starter: node serve.js
npm run preview # static starter: serves dist/client
```

Components outside `src/routes` resume without being listed: `rivetRouter` resumes every app component file a route imports (`resume.appModules`, default `true`).

If resuming in dev gets in your way (for example a very large page), turn it off. Pages then render in the browser from the first load; serialization errors still show:

```ts title="vite.config.ts"
rivetRouter({ dev: { resume: false } })
```
