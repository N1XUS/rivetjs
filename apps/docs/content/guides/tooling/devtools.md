---
title: DevTools
description: Inspect components, signals, DOM updates, hot updates and errors of a page on the dev server with Rivet DevTools.
template: guide
status: experimental
related: [guides/tooling/dev-server-and-hot-reload, guides/state/signals, guides/performance/measuring]
---

Rivet DevTools is a panel inside your page on the dev server. It shows the components on the page, every signal and what depends on it, which DOM nodes update, each hot update and every error. You can change any value to test a state, override computed values and props, and see which contexts each component reads. The router, i18n and forms get panels of their own, and the Performance panel points to layout shifts, slow updates and slow interactions.

After reading this page you can open DevTools, find a component, edit its state, and see what updates and why.

DevTools works only on the Vite dev server. Builds never include it, and production bundles are byte-for-byte the same with or without it.

## Turn it on

Install `@rivetjs/devtools` as a dev dependency. With `rivetRouter()` or `rivet()` in your Vite config, DevTools is then on for `vite` (the dev server) by default.

To turn it off:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ devtools: false })],
});
```

`rivet({ devtools: false })` does the same without the router.

## Open the panel

- Press :kbd[Alt]+:kbd[Shift]+:kbd[R], or click the round **R** button at the bottom right of the page.
- Close it with the same keys or the **×** button.
- **Pop out** moves the panel into its own window. It stays connected across page reloads.

The panel is also served at `/__rivet/devtools/` under your Vite `base`.

## Components

The **Components** panel shows a tree of the components on the page.

- Hover a component in the tree: the page outlines its elements and shows its name.
- Click **Pick**, then click an element on the page to select the component that rendered it. :kbd[Esc] cancels.

The side pane shows, for the selected component:

- the source file (click to open it in your editor) and its owner chain (click a component to go to it),
- **Why it last updated**: the signal write that last re-ran one of its effects, bindings or computed values, where that write happened, and a **DevTools edit** badge if the write came from the panel,
- its signals and computed values (with how often and how long they ran),
- how many effects and bindings it has,
- **Context provided**: the context values it provides and which components read them,
- **Contexts read**: each context it reads, the current value, and the component that provides it (click to jump to the provider),
- its props,
- **Depends on**: the signals and computed values from other components that it reads,
- **State used by**: the components that read its signals and computed values,
- how many DOM updates it caused.

The tree follows ownership: who created whom. A page passed as `children` to a layout appears next to the layout, not inside it. Helpers like `For`, `ChunkGroup` and `Provider` are hidden.

## Signals

The **Signals** panel lists every live signal. Filter by name, owner, value, file or `#id`. Select a signal to see where it was created, its owner chain, how often it was written and its last write, and:

- **Depends on**: the signals and computed values it reads.
- **Used by**: the computed values, effects and bindings that read it, up to three levels.

Signals are named after the variable or property they are assigned to, scoped by component: `Cart › count`. That works in components and in plain `.ts` and `.js` modules of your app. A signal created in a dependency shows `signal #id`.

## Edit values

### Edit a field in place

Double-click a value in any tree to edit it. Pick the type (string, number, boolean, bigint, date, `null`, `undefined` or JSON), type the value and press :kbd[Enter]. :kbd[Esc] cancels. Booleans toggle with a double-click.

This works inside any value, including `Map` entries, `Set` members, dates, bigints, `undefined` and class instances. Containers have buttons to add and remove items:

- **+ key** on objects, **+ entry** on maps, **+ member** on sets, **+ item** on arrays,
- **×** next to a row removes it.

How the write happens:

- Objects, arrays, maps and sets on the way to the field are copied. The signal gets the new copy through its own `.set`, so the page updates like after a real change.
- A class instance is changed in place, because a copy could lose its private state. If the signal holds the instance itself, DevTools then tells the signal's observers that it changed. A signal with a custom `equals` may still ignore that.
- Getters are never called or written. Frozen and read-only fields cannot be edited; the panel says why.

### Replace a whole value

Click **edit** next to a signal, type JSON, and press **Set** or :kbd[Enter]. Input that is not valid JSON is rejected.

### Override computed values and props

Editing a computed value or a prop sets a temporary debug override:

- A computed value keeps the overridden value until you click **Reset**, even when its sources change.
- A prop keeps the overridden value until you click **Reset**. A prop passed as a signal or a computed value also resets on its next real change.

Overridden rows are marked **overridden** and show the real value next to the **Reset** button. Overrides exist only while DevTools runs on the dev server. Event handlers cannot be overridden.

### Edit a context value

If a provider supplies a signal (`<Provider context={Theme} value={theme}>`), edit it in **Context provided** and every consumer updates.

A plain value is read-only: each consumer reads it once when it is set up, so a change could not reach it. To edit it live, provide a signal.

## Contexts

The **Contexts** panel lists each provider on the page: the context, the component that provides it, its value and the components that read it. Click the provider or a consumer to select it.

Contexts are named after their `createContext` variable (`ThemeContext`), else their `id`. A second context with the same name gets a number (`ThemeContext#2`).

## Router

The **Router** panel appears when the app uses `@rivetjs/router`. It shows:

- the route pattern, URL, params and how long the route took to load,
- the loader data of each layout and of the page,
- the layout chain,
- the navigation in progress, if any,
- the last navigations: where to and from, push, replace or back, what started them and how long they took.

## i18n

The **i18n** panel appears with the `i18n()` plugin. It shows the page locale and direction, the configured locales, each catalog with its key count, the message keys that went missing this session (with counts), and the keys a locale takes from its fallback.

## Forms

The **Forms** panel appears when the page uses `createForm` or `createAutosave`. For each form it shows the current values, the touched and changed fields, the errors shown, whether it is submitting, and the autosave status (saved version, unsaved fields, errors and conflicts). Password fields are masked.

## Performance

The **Performance** panel finds what makes the page slow and names the component responsible.

At the top it shows:

- **CLS**: how much the layout moved without user input. Good is 0.1 or less, poor is over 0.25.
- **Slowest interaction**: the slowest click or key press. Good is 200 ms or less, poor is over 500 ms.
- **Chunks after input**: script files the page loaded after a click or key press, with their size, and how long the first interaction took. For a resumed page this is what resuming cost.

Below that are a timeline of everything found, a table of components, a table of interactions and the list of findings. Click a column header to sort the component table. Each finding names its components (click to select one), links to the source where it can, and explains why it matters and how to fix it.

DevTools finds:

- **Layout shifts**: content that moved on its own. The score goes to the components whose elements moved. Turn on **Show layout shifts** to flash the moved elements in the page.
- **Forced reflows**: code that changes the DOM and then reads layout (like `offsetWidth` or `getBoundingClientRect()`) in the same task, inside an effect, a binding or an event handler. Turn on **Detect forced reflows** first. It is off by default because it slows DOM work a little. It stays on for the browser tab, so a reload also checks the page start.
- **Long frames**: frames over 50 ms, with the components whose updates ran in them.
- **Effects that run too often**: an effect or computed value that ran 10 times or more for one interaction.
- **Slow interactions**: clicks and key presses over 200 ms, split into input delay, processing and presentation, with the components that updated while handling them.
- **Chunks loaded after input**: the files an interaction had to wait for.

The component tree marks components with findings with **⚠** and the reason. Click it to see that component's findings.

**Highlight updates by frequency** flashes updated DOM nodes in colors: blue for one update, then green, amber and red for 8 or more updates a second.

## Resumed pages

Dev pages resume like production pages: the browser does not run the components, so there is nothing to show in the component tree.

DevTools measures first and inspects second:

- While the page is resumed, the **Performance**, **Updates**, **HMR** and **Errors** panels work on the real resumed page. The Performance panel shows the resumed page's layout shifts, interactions and the chunks each interaction loaded.
- Opening **Components**, **Signals**, **Contexts**, **Router** or **Forms** switches the page to rendering in the browser, the same way your first edit does. A line under the tabs says "Switched to client render for inspection" and up to when performance was measured on the resumed page.
- DevTools remembers the last panel for the browser tab. Reopen it on **Performance** and reload to keep measuring the resumed page.

To render in the browser from page load instead, set `rivetRouter({ dev: { resume: false } })`. See [Dev and production differ](../../gotchas/dev-and-production-differ.md).

## Updates

Turn on **Highlight updates** to make DOM nodes flash when their bindings run. This shows quickly whether a click updates only what it should.

The panel also counts DOM updates per component since it opened. **Reset counts** starts again.

## HMR

The **HMR** panel lists Vite updates and hot replacements: which component was replaced, how many instances, and whether state was kept or reset, with the reason (`shape`: the number of signals changed; `kind`: a value changed type; `refresh-reset`: the file has `// @refresh reset`). Full reloads and Vite errors appear here too. The list survives reloads in the same session.

See [Dev server and hot reload](dev-server-and-hot-reload.md) for the rules.

## Errors

The **Errors** panel collects uncaught errors and promise rejections, Vite errors, Rivet's development hints attached to the error they explain, and Rivet's development accessibility warnings. Stack frames from your app open in your editor.

## How it fits in the page

- DevTools loads a small agent script before any framework code on dev pages. If the agent fails, its error appears in the panel; it does not break your page.
- The panel itself runs in its own frame, separate from your app.
- Value previews only read plain properties. Getters are listed, not called.
- The router, forms and i18n panels use development-only entry points of those packages. Production builds use the normal entry points.

## Limits

- Dev server only. Development builds and resumed production pages are not supported yet.
- No panels yet for `Async` state or event timing.
- A prop read once at setup (`({ label }) => …`) keeps its real value under an override. Reads of `props.label` see the override.
- The Router panel shows the route pattern, not the file name. On a resumed page it fills in after the first client navigation.
- The i18n panel reports missing keys only for keys built at runtime (`` t(`menu.${key}`) ``). Static keys are checked when the app is compiled.
- `model:` bindings are not highlighted.
- The Performance panel counts component updates only while the panel is open. Layout shifts, long frames, interactions and loaded chunks are counted from the page start.
- **Slowest interaction** is the slowest one, not the INP value Chrome reports for many interactions.
- Long frames list scripts only in browsers with long-animation-frame timing (Chromium).
- A layout shift is scored on the components that moved, which are not always the cause. Look for what was inserted or resized above them.

## See also

- [Dev server and hot reload](dev-server-and-hot-reload.md)
- [Signals](../state/signals.md)
- [Measuring](../performance/measuring.md) for production pages
