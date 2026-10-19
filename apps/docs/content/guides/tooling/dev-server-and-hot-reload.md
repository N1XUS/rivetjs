---
title: Dev server and hot reload
description: Run the Vite dev server, see how hot reload keeps component state, and use the @refresh reset comment when you want fresh state.
template: guide
status: experimental
related: [guides/tooling/vite, guides/tooling/devtools, gotchas/dev-and-production-differ]
---

The dev server shows your changes as soon as you save a file. For most edits it does not reload the page: it swaps the changed component in place and keeps its state. This is :term[hot reload]{id=hot-reload}.

After reading this page you know how the dev server renders pages, what hot reload keeps and what it resets, and how to opt out.

## Start the dev server

```bash
npm run dev
```

This runs `vite`. With `rivetRouter()`, the dev server renders each page through the same request handler as production, including guards, loaders and actions (`serverGuard`, `serverLoad`, `serverActions`).

## Dev pages resume

Like in production, the browser :term[resumes]{id=resumability} the server's HTML: no component runs in the browser, and a button's code loads when you use it (one file per component). Serialization errors show in the error overlay with the component, file and line.

Resumed parts of a page are not components the browser could swap, so on your **first edit** the page switches to rendering in the browser (state of the resumed page starts fresh once). From then on, hot reload works as described below. Reload the page to resume again.

- Code is not bundled or minified, so judge performance with a production build (`npm run build`, then `npm start` or `npm run preview`).
- `rivetRouter({ dev: { resume: false } })`: pages render in the browser from the first load (state is kept from the first edit on).

See [Dev and production differ](../../gotchas/dev-and-production-differ.md).

## What hot reload keeps

When you save a component file, every exported component in it is replaced in place. The rest of the page stays as it is.

State is kept like this:

- **Signals** created while a component renders get their previous values back, matched by creation order: the first `signal()` gets the old value of the first, and so on.
- **Child components** that are also hot-replaceable keep their state by position.
- A changed initial value does **not** reset the state. If you change `signal(0)` to `signal(10)`, the counter keeps its current value.

```tsx title="src/components/Counter.tsx"
import { signal } from "@rivetjs/reactivity";

export function Counter() {
  const count = signal(0);
  // Edit this text and save: the count stays.
  return <button onClick={() => count.set(count() + 1)}>Clicked {count()} times</button>;
}
```

## What resets state

- **A different number of signals.** If you add or remove a `signal()` call, the component renders again from scratch, and all its signals start fresh.
- **A different kind of value.** If a signal held a number and now starts as a string, that one signal resets.
- **A `// @refresh reset` comment** anywhere in the file. Then the module always starts fresh on each update.

```tsx title="src/components/Wizard.tsx"
// @refresh reset
import { signal } from "@rivetjs/reactivity";

export function Wizard() {
  const step = signal(1);
  return <p>Step {step()}</p>;
}
```

Use `@refresh reset` when kept state gets in the way, for example when you change what a signal means.

## When the page reloads instead

Hot replacement works for modules whose exports are components: capitalized function exports and the default export function. In other cases the update goes to the importing modules, as normal Vite does, and may reload the page:

- The module also exports other values (constants, helpers), and one of them changed.
- The module uses export forms the plugin does not handle, such as re-exports (`export … from`).
- You add or delete a route file. The router regenerates its route table and reloads the page.
- You edit an i18n catalog. The texts are rebuilt and the page reloads.

Keeping helpers in their own files, and components in theirs, makes hot replacement work more often.

## Server code

Edits to server-only code (`*.server.ts` files, or an in-file `serverLoad`) take effect on the next request: the open page fetches its data again and re-renders, and component state resets. Adding or removing a server export updates the route table and reloads the page. Edits to the document shell take effect on the next request; reload the page to see them.

## Warnings and errors

Every warning or error Rivet prints in the terminal or the browser console says where it comes from and how to fix it:

```text
[RV1016] /app/src/routes/index.tsx:12:7: Event handler onClick expression is evaluated once at render …
  fix: Wrap the handler expression in an arrow so it is re-read per event: onClick={(event) => (s() ? a : b)?.(event)}.
  docs: https://rivetjs.severyn.pro/errors/RV1016
```

- **Who reported it.** Compile errors start with their `RVnnnn` code. Other messages start with the package that printed them: `[rivet:router]`, `[rivet:i18n]`, `[rivet:cdk]`.
- **Where.** Compile errors give `file:line:col` and a code frame (Vite's error overlay shows the same frame). Warnings printed while a component renders add an `in` line with the component chain, innermost first, each with the file where it is declared: `in <Field> (src/field.tsx:4:17) ← <Page> (src/routes/index.tsx:9:17)`. Warnings from server rendering add an `at` line with the first frames of your code in the stack.
- **How to fix it.** A `fix:` line with the remedy, and a `docs:` link to the page that explains it. Compile errors get their `fix:` line from `@rivetjs/language-core` (installed by the starters); without it they still link the docs.

Messages from the browser reach the terminal through Vite (`[vite] (client) [console.warn] …`), with the same lines.

`rivet-check` prints a code frame, `fix:` and `docs:` lines under each diagnostic. See [Language service](language-service.md).

## Accessibility warnings

In dev, Rivet checks the rendered page for common accessibility problems and warns once per element, for example:

```text
Rivet a11y [accessible-name]: <button> has no accessible name — add text content, aria-label or aria-labelledby.
  in <IconButton> (src/icon-button.tsx:3:17) ← <Toolbar> (src/toolbar.tsx:8:17)
  element: main > div.toolbar > button
  docs: https://rivetjs.severyn.pro/guides/tooling/dev-server-and-hot-reload#accessibility-warnings
```

- `in` names the components that rendered the element. Elements from server HTML that no client component rendered say so, with the page path.
- `element` is a CSS path; paste it into `document.querySelector("…")` in the browser console to find the element.
- The checks cover missing accessible names, images without `alt`, labels without a control, references to ids that do not exist, duplicate ids, positive `tabindex` values, and click handlers on elements that cannot be focused.
- Turn the checks off for a page with `<html data-rivet-a11y="off">`.

## DevTools

If `@rivetjs/devtools` is installed, the dev server also loads Rivet DevTools. Its **HMR** panel lists each hot update, with whether state was kept or reset and why. See [DevTools](devtools.md).

## Common mistakes

- **"It works in dev but not in production."** Usually top-level component code expects to run in the browser. Check a production build.
- **State that never resets.** The signal count did not change, so the old values stay. Add `// @refresh reset` or reload the page.

## See also

- [Vite](vite.md)
- [DevTools](devtools.md)
- [Dev and production differ](../../gotchas/dev-and-production-differ.md)
