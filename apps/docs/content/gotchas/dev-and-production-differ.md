---
title: Dev and production differ
description: Dev pages resume like production; what still differs (bundling, reload on edit, development checks), and how to test the real behaviour.
template: gotcha
related: [learn/resuming, guides/tooling/dev-server-and-hot-reload, guides/tooling/vite]
---

## What you see

Something works with `npm run dev` but not after `npm run build`, or the other way round. Typical cases:

- After you saved a component file, the page reloads and the counter you clicked is back at 0.
- In dev, the browser loads many small modules. In production it loads a few bundled chunks.
- A page in a non-default locale (i18n) renders in the browser in dev even before any edit.

## Why

In production, the page :term[resumes]{id=resumability}. The server renders the HTML and writes the state of its interactive components into it. The browser runs a small loader and runs a component's code only when you use it.

The dev server does the same: the same HTML, state and loader, and a component's code runs when you use it (one file per module, served by Vite). Warnings such as route data that cannot resume ([RV2107](../errors/RV2107.md)) print in the terminal.

What differs:

- **An edit of a component file reloads the page**, which then resumes the new code. An edit that only changes a `css` block updates the styles in place.
- Code is not bundled or minified, and the browser fetches the files of a page's interactive components one module at a time.
- Pages in a non-default i18n locale render in the browser, as with `dev: { resume: false }`.
- **Development checks.** Dev and production compile components to the same DOM code (cloned templates, delegated events). In dev the runtime adds checks on top: a warning when a dynamic style value is dropped (for example one with `url(`), and a warning naming a component whose browser render differs from the server's markup. Production builds leave the checks out, so they are smaller and a little faster.

## Fix

Use dev for fast editing. Check speed and bundle size in a production build:

```bash
npm run build   # vite build && vite build --ssr  (static starter: also prerenders)
npm start       # server starter: node serve.js
npm run preview # static starter: serves dist/client
```

Components outside `src/routes` resume without being listed: `rivetRouter` resumes every app component file a route imports (`resume.appModules`, default `true`).

If resuming in dev gets in your way (for example a very large page), turn it off. Pages then render in the browser from the first load, and edits hot-replace components keeping their state:

```ts title="vite.config.ts"
rivetRouter({ dev: { resume: false } })
```
