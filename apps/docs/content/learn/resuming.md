---
title: Resuming
description: How a Rivet page keeps working in the browser without running your components on load, and what that means for state, props and render code.
template: concept
status: experimental
related: [learn/server-first, learn/loading-code, learn/signals, gotchas/component-did-not-run-again]
---

Resuming means the browser picks up where the server left off. The server renders the page and writes down the little the browser will need later. The browser runs nothing on load; when you use a part of the page, it runs that part's code over the HTML that is already there. The glossary calls this :term[resumability]{id=resumability}.

## What it is

Think of a board game you pause. You do not replay every move to continue tomorrow. You write down where each piece stands and continue from that.

A Rivet page works the same way:

- The **server** runs your components once and writes the HTML. For each component that can react to input (it has a handler, reads a signal in its markup, or uses an effect), it also writes a short record: where the component is in the page, the values of the signals it created, and, when its props are plain data, those props.
- The **browser** gets the HTML, those records and a small loader script (about 1.1 KB compressed). When you use the page, it loads the code of the component you touched and of the components around it that have not run yet, and runs them over the existing HTML, starting from the recorded values.

## Why it matters

The common alternative is :term[hydration]{id=hydration}: the browser downloads the code of every component on the page and runs it all on load, to rebuild in memory what the server already had. On a large page that means a lot of JavaScript to download and run before the page reacts reliably.

With resuming:

- **The browser runs none of your component code on load.** A page that only shows content stays HTML and CSS, plus the loader. (With file routes, the router's code also loads after the page appears.)
- **Work grows with what you use, not with page size.** A component with plain-data props waits for its own first use: a card that nobody touches never runs. The first event still runs the components around the one you touched (their handlers may see the event bubble): with file routes, the router's root, the layouts and the page, together with the components that run with them.
- **The first click is fast.** After the page has loaded, the loader fetches the page's code at low priority without running it, and it starts loading a component's code when you point at or focus it.

## How it works

Try it. The component below shows the time when it rendered. Click the button a few times:

::example{id=resume-demo}

The time does not change. It was taken while the HTML was made and kept in a signal, so its value is in the page. The first click loads `ResumeDemo`'s code and runs it over the server HTML: the signals start from the values the server wrote, so the text stays the same, and the handler is attached to the existing button.

Step by step:

1. **Server.** `ResumeDemo()` runs. It creates the signals `renderedAt` and `count` and returns JSX. Because the component has a handler, the server marks where it starts and ends in the HTML and records the two signal values.
2. **HTML.** The page carries the markup, the component's markers and a `<script type="rivet/boundaries">` with the records: "component `ResumeDemo`, its signals are `"2026-…"` and `0`". The inline loader follows it.
3. **Browser, on load.** The loader runs. It listens for events on the whole document. Your component code does not run.
4. **Browser, on intent.** You move the pointer over the button. The loader starts fetching the file that contains `ResumeDemo`.
5. **Browser, on click.** The runtime runs `ResumeDemo`'s compiled code over the existing nodes: it creates no element and moves none, it attaches the handler and the text binding, and each signal takes its recorded value. The components around it that have not run yet run the same way first (here, only the example page). Then the click reaches the handler: `count.update((n) => n + 1)` updates the text.

The "Server HTML" tab of the example shows the real markup.

## Components that wake up

A component whose subtree has nothing interactive gets no record and never runs in the browser. One that does is picked up (the browser runs it) the first time it is needed:

- an event inside it (a click, a key, an input),
- a change of a signal it read on the server (another component writes it),
- its trigger: a [`clientEffect`](../guides/state/effects.md#choose-when-it-starts) or `clientOnly` part with `when: "load" | "idle" | "visible"`.

**Props decide who runs together.** A component whose props are plain data (strings, numbers, plain objects and arrays, dates, `Map` / `Set`, signals of its parent) waits for its own first use: its props are in its record. A component that gets a function, a JSX child with handlers or a value that is not data runs together with its parent, which passes it the real values. Passing plain data is what keeps the browser's work small.

**Nodes stay where they are.** The browser walks the server's nodes instead of creating new ones, so focus, typed text, selection and scroll position survive. A press on an element whose code is still loading is held and replayed once it runs, with the focus a loaded page would have seen.

## Render the same thing twice

The browser repeats a component's render over the server's HTML, so the render has to give the same result in both places:

- A value that differs between server and browser (`Date.now()`, `Math.random()`, `new Date()`, `crypto.randomUUID()`, `performance.now()`) in a component's render is an error ([RV2103](../errors/RV2103.md)). Keep such a value in a signal (`signal(Date.now())`: the server's value is written into the page and the browser starts from it), or compute it in a handler or `clientEffect`.
- A signal created inside a loop is a warning ([RV2104](../errors/RV2104.md)): signals are matched by the place they are created, and a loop creates many at one place. A signal created under a condition is fine.
- Code that reads browser globals (`window`, `localStorage`) in the render gives different markup in the browser; read them in a `clientEffect`.

If the markup still differs, that component renders in the browser instead of reusing the server nodes (development prints a warning naming it).

## What reaches the browser

The page carries values, never code:

- **Signal values** of the components that wake up. A signal created by a component holds data the browser can read back: strings, numbers, booleans, `null`, plain objects and arrays, `Date`, `Map`, `Set`, `URL`, `bigint`, typed arrays. A signal holding something else (a function, a class instance) starts again from its initial value in the browser.
- **Props** of components whose props are plain data.
- **Route data**: with file routes, the page's root component gets the route's loader data as props, so the browser rebuilds the router and the current page from it without a data request. Loader data may hold values JSON cannot (a `Date`, a `Map`, a `Set`, a `BigInt`, a `URL`, shared objects); they arrive as the same values. A value Rivet cannot send (a function, a symbol, a promise, an instance of an unregistered class) prints a warning ([RV2107](../errors/RV2107.md)), and the page then renders in the browser instead of resuming.

Functions and objects your components build are not sent: the browser builds them again when it runs the component. A handler can use any value of its component, a library object created in the render included, because the browser has the real one.

### Classes in route data

Loader data that holds instances of your own classes, or of a package class (bson's `ObjectId`, whose state is private), needs `registerClass`. `id` names the class in the page; it must be unique and must not contain `#`:

```ts
// src/resume-classes.ts
import { ObjectId } from "bson";
import { registerClass } from "@rivetjs/runtime/resume-format";

registerClass(ObjectId, {
  id: "bson.ObjectId",
  serialize: (value) => value.toHexString(),
  revive: (hex) => new ObjectId(hex as string),
});
```

The browser looks the class up by `id` in its own registrations, so this module must run on both sides: import it from your server code (for example the root layout) and from a module the page's components import. A page that uses an id the browser did not register fails when the data is read: "Resume class `bson.ObjectId` is not registered here". Registering another class under a taken `id` throws; registering the same class again replaces its hooks.

## Lists

A keyed [`<For each={…} by={…}>`](../guides/components/lists.md) sends its items once (with the component's data props or the route data) and no record per row. The browser runs a row's code only when the row is used: an event inside it, or a change of a value it shows. Selecting one row of a 1,000-row list runs that row and the one that lost the selection.

### Data from the page

With `resume: { domData: true }` on `rivetRouter(…)` (or `rivet(…)`), the items of a `<For>` over a component's data props (a route's loader rows) are left out of the page when every value the rows show is the item's: the browser reads them back from the rows the page shows, the first time code uses them, and the rest in short idle slices after it starts. Off by default: on a 1,000-row page the resume data goes from 8.5 KB to 0.3 KB brotli, and the first click costs a few milliseconds more at 4× CPU slowdown (the rows are found and read in the browser).

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { domData: true } })],
});
```

- **What qualifies.** Strings and numbers a row shows as an element's whole text (`<dd>{row().name}</dd>`) or as a plain attribute value (`data-id={row().id}`). A row whose values the page does not spell exactly is sent as before. Items of collection components (`ListBox`, grid list) are still sent in full.
- **Do not edit the server markup before the page starts.** A script that rewrites row text at load would change the data the page reads back.

## Loaded data, forms and islands

- **`Async` and `Suspense`.** `Async` content is resumed, with or without a fallback function, also inside a component's children, under a provider or in the rows of a `<For>`: an `Async` without a fallback and `Suspense` content are awaited in place on the server, also when the page streams; the server's value is used and its `load` does not run again in the browser (so it does not reload when something its load read changes). With `rivetRouter` a value JSON cannot hold, such as a `Date`, arrives as the same value.
- **`resource`.** A resource resumes with the state the server settled, inside `Suspense` or not: it does not load again in the browser until its source changes or it is refetched.
- **Forms** keep progressive enhancement, enhanced submit and revalidation ([forms](../guides/forms/forms.md)).
- **[Framework islands](../guides/components/framework-components.md#pages-with-only-islands).** An island with plain JSON props starts through the islands' inline script; one that needs Rivet (live props, callbacks, Rivet slot content) starts with the component that renders it, by its `client` policy.

## What it does not do yet

- **A load still pending when the page was sent.** A `resource` or `Async` value JSON cannot hold, or a load still pending when the page was sent, loads in the browser; if that load suspends a `Suspense`, the component holding it renders again in the browser the first time it is used (development prints a warning naming it).
- **Hover state on a replayed press.** The hover state of the pressed element (`data-hovered`) can differ from a loaded page until the pointer moves, and some collection components (tag group, grid list, tree) still render again in the browser on their first interaction.
- **`when: "interaction"` / `"media:(query)"`** of a `clientEffect` or `clientEvent` start it when its component is first used, not at the first press anywhere on the page or when the query matches (plan M6).
- **Dev edits reload the page.** The dev server serves pages resumable like production; an edit of a component reloads the page.

## What it means for your code

- **The component body runs on the server, and again in the browser when the component wakes up.** It never runs on load. A `console.log` there prints in the terminal, and in the browser console once the component is used. See [component did not run again](../gotchas/component-did-not-run-again.md).
- **Write browser behaviour as handlers or client effects.** `onClick`, `onInput`, `onSubmit`, `clientEffect` and `clientEvent` are the places where code runs in the browser on its own schedule.
- **Pass data, not services.** A component with plain-data props wakes up alone; a function or service prop makes it run with its parent. See [pass data, not services](../best-practices/pass-data-not-services.md).
- **Props are live when the caller passes a reactive value; literals are static.** A component counts as able to react to input when it has its own handler, client effect or event, its own signal, store or resource, reads module state (a signal or store from another module; a module constant holding a literal table or an imported asset is data), or renders such a component. A handler that may be absent (`onScroll={track ? sync : undefined}`, a forwarded `props.onSelect`) counts per use: only a use that gets a function is picked up. A component that only shows its props or a context value counts only when what flows in can change: a caller passes it a function, a signal's value, or a prop the caller itself gets live, or the provider of the context it reads is such a component. Each use is decided on the server: a use where nothing that flows in can change leaves nothing for the browser. `<Meter color="success" value={40}>` ships no JavaScript and is never picked up in the browser; `<Meter value={level()}>` inside a component with a `level` signal is picked up with that component.
- **Keep state in signals.** A value the browser must see as the server had it (a time, a random pick, a value a request produced) belongs in a signal created by the component.
- **Components outside `src/routes` resume too.** `rivetRouter` resumes every `.tsx`/`.jsx` component file in your project that a route imports; no list needed. To opt out, set `resume: { appModules: false }` and list files in `resume.modules`.
- **The first mouse click updates the page one task later.** The handler runs during the click as usual; the DOM update of a page's first mouse click lands in the next task, because Chrome would otherwise hold the next frame. Tests that read the DOM right after that click must wait. See [batching](../guides/state/batching.md#the-first-mouse-click-on-a-page).
- **Check speed with a production build.** See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Related

- [Loading code](loading-code.md): when and how the browser fetches each piece of code.
- [Signals](signals.md): how Rivet knows which part of the page to update.
- [Server first](server-first.md): what runs on the server and what in the browser.
