---
title: Resuming
description: How a Rivet page keeps working in the browser without running your components again, and what that means for handlers, state and captured values.
template: concept
status: experimental
related: [learn/server-first, learn/loading-code, learn/signals, gotchas/function-is-not-serializable, gotchas/component-did-not-run-again]
---

Resuming means the browser picks up where the server left off. The server renders the page and writes down what the browser will need later. The browser reads those notes and continues from there. It does not run your components a second time. The glossary calls this :term[resumability]{id=resumability}.

## What it is

Think of a board game you pause. You do not replay every move to continue tomorrow. You write down where each piece stands and continue from that.

A Rivet page works the same way:

- The **server** runs your components once, writes the HTML, and saves the current state: the values of signals, which elements have handlers, and which parts of the page depend on which signals.
- The **browser** gets the HTML, the saved state and a small loader script (about 1.9 KB compressed). When you use the page, it loads only the code for what you touched and continues with the saved state.

## Why it matters

The common alternative is :term[hydration]{id=hydration}: the browser downloads the code of every component on the page and runs it all again, to rebuild in memory what the server already had. On a large page that means a lot of JavaScript to download and run before the page reacts reliably.

With resuming:

- **The browser runs none of your component code on load.** A page that only shows content stays HTML and CSS, plus the loader. (With file routes, the router also loads its link-handling script after the page appears.)
- **Work grows with what you use, not with page size.** A page with a hundred cards and one "Like" button loads the code for the button, not for the cards.
- **The first click is fast.** The loader starts fetching a handler's code when you point at or focus the element, before you click.

## How it works

Try it. The component below records the time when it ran. Click the button a few times:

::example{id=resume-demo}

The time does not change. `ResumeDemo` ran once, at build time, and never again. Only the click handler runs in the browser.

Step by step:

1. **Server.** `ResumeDemo()` runs. It creates the signal `count` with `0` and returns JSX. The compiler has already marked two places: the `onClick` handler, and the text `{count()}`, which reads a signal.
2. **HTML.** The server writes the button with a `data-r` attribute that points at the handler, a pair of comment markers around the text `0`, and a `<script type="rivet/state">` with the saved state: "signal 1 is `0`; the text between these markers shows signal 1".
3. **Browser, on load.** The loader runs. It listens for events on the whole document. (The router's link-handling script also loads; your component code does not.)
4. **Browser, on intent.** You move the pointer over the button. The loader starts fetching the file that contains this handler.
5. **Browser, on click.** The handler runs: `count.update((n) => n + 1)`. The runtime reads the saved value `0` for `count`, sets it to `1`, and updates the text between the markers. Nothing else on the page is touched.

The "Server HTML" tab of the example shows the real markup.

## What the handler can use

A handler often uses values from its component, such as `count` above. These are its captures. Because the component does not run again in the browser, every captured value has to be written into the page as data. A value that can be written like this is :term[serializable]{id=serializable}.

| Can be captured | Cannot be captured |
| --- | --- |
| strings, numbers, booleans, `null`, `undefined` | functions created at runtime by code Rivet did not compile (a library's `memoize(fn)` result), `.bind(…)` written inside an object literal, methods, functions using `this` (also with `.bind(ctx)`) |
| plain objects and arrays of the above | objects that hold functions built outside a component — at module level (`const table = { a: fmt }`) or by your own hook or helper (`function useTable() { return { a: fmt }; }`); build the object inside the component instead |
| `Date`, `URL`, `URLSearchParams`, `Map`, `Set`, `RegExp`, typed arrays, `ArrayBuffer`, `DataView`, `Error`, `bigint` | instances of classes from `.ts` files and packages, and of classes that are not data classes (`#private` fields, a decorator, a base class that is not a data class of the same module, `window` / `document` read while constructing: [RV2102](../gotchas/function-is-not-serializable.md)) — unless you build it with [`reconstruct`](#library-objects-reconstruct) or the class rebuilds itself ([resource holders](#resource-holders-and-package-classes)) |
| instances of a **data class** declared in a component module (plain fields): the browser gets an object of that class with the same fields and methods; the constructor does not run again | |
| signals and `computed` values | promises, `WeakMap`, symbols |
| functions written in a component: local `const f = () => …`, inline props (`onChange={(v) => …}`), values in objects, returned functions, function defaults (`{ format = (n) => … }`), functions written straight into, or stored by name in, a value a handler uses (`api.inc = () => …`, `api.open = open`, `list.push(open)`, `signal(() => …)`, `[() => …]`, `new Map([["k", () => …]])`) — also after they travel through props; local functions that call each other (`even` / `odd`); `.bind(…)` of such a function or of a module-level one: inline in a prop or handler, or a local constant (`const inc = add.bind(null, 2)`, also a `.bind` of that) used by name anywhere (captured, passed as a prop or argument, stored in an object / array) | |
| module-level and imported functions (also npm exports) used by name inside a component: called, passed as a prop, kept in a local constant, or stored in an object / array / call argument (`{ format: formatEuro }`) — the page refers to the module's own function | |

If you capture something that does not fit, rendering fails with an error such as "function is not serializable". See [function is not serializable](../gotchas/function-is-not-serializable.md) and [serializable captures](../best-practices/serializable-captures.md).

### Resource holders and package classes

Some objects hold something the page cannot write down: an open connection, a handle, or private state of a package class. A class can say how to rebuild its instances instead. `[serialize]()` returns the data to write into the page, and `static [revive](data)` builds a new instance from it in the browser:

```tsx
import { revive, serialize } from "@rivetjs/runtime/resume-format";

class Conn {
  url: string;
  socket: WebSocket | undefined;
  constructor(url: string) {
    this.url = url;
    this.socket = typeof window === "undefined" ? undefined : new WebSocket(url);
  }
  [serialize]() {
    return { url: this.url };
  }
  static [revive](data: { url: string }) {
    return new Conn(data.url);
  }
}
```

- Only what `[serialize]()` returns is written into the page; it must be serializable itself. A class with `[serialize]()` is always sent this way, also when its fields alone could be sent as data.
- `static [revive](data)` runs in the browser the first time a handler uses the instance, so the constructor runs there (here: the socket opens on first use).
- `[serialize]()` without `static [revive]` stops the render with `RV2102: Conn has [serialize] but no static [revive]`.
- The data cannot lead back to the instance: the reviver needs the data first, so the browser stops with "Cyclic reference through revive of Conn" when a handler first reads it. Keep resource holders' data free of values that point back at the holder, including captured functions that use the holder: whether such a cycle decodes depends on which value a handler reads first.

A class you cannot edit (a package class such as bson's `ObjectId`, whose state is private) registers the same two steps with `registerClass`. `id` names the class in the page; it must be unique and must not contain `#`:

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

The browser looks the reviver up by `id` in its own registrations, so this module must run on both sides: import it from your server code (for example the root layout) and from your resume entry (`resume: { entry }`, see [Vite](../guides/tooling/vite.md)). A page that uses an id the browser did not register fails when the handler first reads the value: "Resume class `bson.ObjectId` is not registered here". Registering another class under a taken `id` throws; registering the same class again replaces its hooks.

### Library objects: reconstruct

A library object that holds functions (a chart, an editor, a socket client from a package) cannot be written into the page, and you cannot add `[serialize]` to it. Build it with `reconstruct` instead: the page carries no value, and the browser runs the factory the first time a handler reads it.

```tsx
import { signal } from "@rivetjs/reactivity";
import { reconstruct } from "@rivetjs/runtime/dom";
import { createChart } from "chart-lib";

export function Sales() {
  const size = signal(4);
  const chart = reconstruct(() => createChart(size()));
  return <button onClick={() => chart().resize(size.update((n) => n + 1))}>Grow</button>;
}
```

- `reconstruct(factory)` returns an accessor: call it (`chart()`) to get the value.
- What the factory uses from the component (here the signal `size`) follows the handler rules above and goes into the page; the value it returns never does.
- Lazy: the factory runs on the first read, on the server only when the render reads it.
- A render that reads it (`{conn().status}` in JSX) runs the factory on the server for every request, so a factory that opens a browser-only resource (a WebSocket, a chart on a DOM node) should only be read from handlers and `clientEffect`.
- Reactive: a factory that reads signals runs again when they change; `onCleanup` inside it disposes the previous value.
- In the browser the factory runs under the same context providers as on the server.
- The error for such a capture names it: "function is not serializable: build it inside the component, or a library object with reconstruct(() => …)". A class instance: "Chart instance is not serializable (your class: build it with reconstruct(() => new Chart(…)) or give it a static [revive]; a package class: registerClass(Chart, { id, serialize, revive }))".

App singletons (an analytics client, an API client) work the same way: a module-level `export const analytics = reconstruct(() => createAnalytics(key))` replaces passing the value to `createResume({ contexts })` in the resume entry. On the server such a module-level value is one instance per process: it is created on the first request that reads it and shared by every later request, so its factory must not read request state (cookies, the user, context values); build per-request values with `reconstruct` inside the component.

## Large data in resume state

Every captured value is written into the page, in the `<script type="rivet/state">` the browser parses before the first interaction. A handler that captures a whole list sends that list a second time, next to the HTML that already shows it. In development the server warns when one captured value takes 8 KB or more of that state:

```text
Rivet resume: <Picker> onClick handler captures `products` (src/routes/shop.tsx#Picker$k2f): array of 1,000 objects, 61.3 KB of rivet/state (warning threshold 8.0 KB; this page's state so far 64.0 KB) — every captured value is written into the page as data and parsed before the first interaction
  fix: 1. do not capture it: …
  docs: https://rivetjs.severyn.pro/learn/resuming#large-data-in-resume-state
```

- The warning names the component, the site (a handler, a binding, a region, a `For`'s row items, a provider value, or a function or `computed` the site reaches), the capture as written, the value's shape and the bytes it adds. A value that several sites share counts once, at the first site that captures it.
- It prints once per site and server process. A page whose whole state passes 64 KB also gets one summary with its three largest sites.
- Thresholds, in bytes, from the server environment: `RIVET_STATE_WARN_BYTES` for one value (default `8192`) and `RIVET_STATE_BUDGET_BYTES` for the page (default `65536`). `off` or `0` turns one off. Production builds print nothing and contain none of this code.
- Not counted as captures: `Async` results that no handler or binding captures (they are HTML), and lazy row records.

What to change, in this order:

1. **Do not capture it.** Read the data on the server and capture only what the browser code needs: an id, a key, a count. A handler that reads members of a `const` object captures just those members, so `onClick={() => cart.add(product.id)}` ships one number:

   ```tsx
   import { signal } from "@rivetjs/reactivity";

   export function AddButton(props: { product: { id: number; name: string; specs: string[] } }) {
     const product = props.product;
     const cart = signal<number[]>([]);
     return <button onClick={() => cart.update((ids) => [...ids, product.id])}>Add {product.name}</button>;
   }
   ```

2. **Load it in the browser.** Serve the data from an [endpoint](../guides/routing/endpoints.md) (`onGet(…)`) and fetch it in the handler that needs it, or in a [`clientEffect`](../guides/state/effects.md#choose-when-it-starts) that fills a signal once the part is visible:

   ```tsx
   import { signal } from "@rivetjs/reactivity";
   import { clientEffect } from "@rivetjs/runtime/dom";

   export function Reviews() {
     const reviews = signal<{ id: number; text: string }[]>([]);
     clientEffect(
       () => {
         fetch("/api/reviews")
           .then((res) => res.json())
           .then((list) => reviews.set(list));
       },
       { when: "visible" },
     );
     return <p>{reviews().length} reviews</p>;
   }
   ```

3. **A list: keyed `For` rows.** Render the rows with [`<For each={…} by={…}>`](../guides/components/lists.md) so each row's handler captures its own item, instead of one handler capturing the whole list. Two build defaults keep that small: [lazy rows](#lazy-rows) cut a row to its key, and [data from the page](#data-from-the-page) leaves out the text the rows already show.
4. **A library object** (a chart, an editor, an SDK client): build it with [`reconstruct`](#library-objects-reconstruct). The browser builds it on first use; nothing about it ships.

### Lazy rows

Lazy rows are on by default in resumable builds. A keyed `<For>` writes no resume records for its rows: the page ships the list's items once and each row as its key, and the browser rebuilds a row from the server HTML when it is first used (its first event, or the first change of a signal it reads). No node is replaced, so focus and typed values stay. The code that rebuilds rows (about 4.9 KB brotli) is a file of its own that only pages with lazy rows load, when the page starts its browser runtime; every page of the build carries about 0.9–2.8 KB brotli more for the hooks it calls into.

Two switches turn them off:

1. **The build option** `resume: { lazyRows: false }` on `rivetRouter(…)` (or `rivet(…)`) in `vite.config.ts`. The build then contains none of the lazy rows code, and every row is recorded.
2. **The server environment variable** `RIVET_LAZY_ROWS=off`, read on every render: rows are recorded as with the option off, and the browser code stays in the build. Use it to compare both on one build.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { lazyRows: false } })],
});
```

- **Not every list qualifies.** The compiler decides per `<For>`: for example the row must be an inline function, `by` a key path such as `(row) => row.id` or an inline function, and the list must not spread props onto the `<For>`, read render props in a row or use values that change between renders (`Date.now()`, `Math.random()`). A row that renders a `Portal`, `clientOnly`, `Async` or `Suspense` content turns the whole list back to recorded rows; development prints a warning naming the reason.
- **Selection wakes only the rows it changes.** A row that reads state through a keyed selector (`selector(signal, fn, { keys: memberKeys })` from `@rivetjs/reactivity`, which the cdk collections use for selection and focus) is rebuilt only when its own key flips: selecting one row rebuilds that row and the one that lost the selection. Select-all still rebuilds every row.
- **Keep a list recorded** with `lazy={false}` on its `<For>` (or a function that returns `false` on the server), for example an outer list whose rows hold another list, so the inner list is the lazy one. The cdk collections do this for sections, tree children and table headers.
- **Server time.** A row that is one element with plain attributes, text and handlers (no components inside) is written straight from its compiled template, as recorded rows are, and costs less server time than recording it: on the 1,000-row benchmark page about 0.6× the CPU per page (0.75× at 5,000 rows). A row that renders components is rendered to HTML in batches of rows, without a renderer per row; on a 1,000-item list box that is about 0.4× the CPU of recording the rows. A row whose content still has to run when it is written (a function child) is rendered on its own. `domData` does not change this. Numbers: [lazy rows cost report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-lazy-cost.md).
- **A signal every row reads plainly** (`class={selected() === row().id ? "on" : ""}`) does not rebuild the rows when it changes: the bindings in the rows that read it run again over the server HTML. On the 1,000-row benchmark page the first click shows after 25 ms at 4× CPU slowdown, against 30 ms with recorded rows. Rows that render components are rebuilt instead.
- **What it costs.** Lists that read selection through keyed selectors get faster: the first click on a 1,000-item list box shows after about 45 ms instead of 120 ms at 4× CPU slowdown, and its resume state shrinks by about three quarters. In a virtualized list the rendered rows read the virtualizer's layout, so the first click or scroll rebuilds the visible window (level with recorded rows, within a few ms), and rows that read a signal load and run their code when the page starts (about 40 ms more script before the first input at 4×, off the click). Every page of the build pays the 0.9–2.8 KB brotli above. Numbers: [lazy rows client report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-lazy-flip.md), [lazy rows against the derived model](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-lazy-vs-derived.md).

### Data from the page

On by default in resumable builds: loader data that list rows already show is not written into the page a second time: a string (8 characters or more) or number that a `<For>` row renders as the whole text of an element (`<dd>{row().name}</dd>`) or as a plain attribute value (`data-id={row().id}`) is left out of the resume state, and the browser reads it back from the page on first use. On a 1,000-row text grid this cuts the state from about 500 KB to 4 KB. `resume: { domData: false }` on `rivetRouter(…)` (or `rivet(…)`) writes that data into the state again, and the build carries none of the code that reads it back:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { domData: false } })],
});
```

- **What qualifies.** Only text that is alone in its element: `<i>Note: {row().note}</i>` stays in the state. Strings with a carriage return, URLs in `href` / `src`, boolean attributes and attributes that change later stay in the state too.
- **Collections too.** Rows of `@rivetjs/cdk` / `@rivetjs/ui` lists such as `ListBox` that show an item's text count as list rows. Grid list rows, the options of a closed `Select` or `ComboBox` and rows a virtualizer does not render stay in the state.
- **Read once.** The browser reads each value the first time code uses it, and every remaining one when the page is first idle. After that a change to the page text does not change the data. On recorded rows (`lazyRows: false`) that first idle read costs script time on long lists (1,000 rows: about 60 ms more before the first input at 4× CPU slowdown); with lazy rows (the default) only the rows that are rebuilt read their values, so turn the two off together or not at all.
- **Do not edit the server markup before the page starts.** A script that rewrites row text at load would change the data the page reads back.
- **What it costs.** Server time is level with the same build without it, with or without lazy rows (a 1,000-item list box with lazy rows: 19.6 against 20.5 ms CPU per render, [lazy rows cost report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-lazy-cost.md)). It adds about 0.6 KB brotli to the browser runtime and about 9 KB to the server code.

## Derived model (experimental)

The sections above describe the default model, which writes a resume record for every handler, binding and captured value. The derived model is an experimental alternative that drops that table.

Off by default. With `resume: { model: "derived" }` on `rivetRouter(…)` (or `rivet(…)`), the page carries no resume state table: the server lists only the components that can react to input (and their signal values), and the browser runs a component's ordinary compiled code over the server markup the first time it is used (an event inside it, or a change of a signal it read on the server). The nodes stay the same, so focus and typed values stay. A component whose props are plain data waits for its own first use; one that gets functions or other non-data props starts with its parent.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { model: "derived" } })],
});
```

- **Smaller pages.** On a 50-row test page with a counter and row clicks the HTML is about 1.7 KB brotli instead of 3.1 KB, and the code loaded on first input about 34 KB instead of 53 KB. Nothing loads before input on either model.
- **Render the same thing twice.** The browser repeats the component's render, so a value that differs between server and browser (`Date.now()`, `Math.random()`, `new Date()`) is an error ([RV2103](../errors/RV2103.md)), and a signal created inside a loop is a warning ([RV2104](../errors/RV2104.md)); a signal created under a condition is fine. If the markup still differs, that component renders in the browser instead (development prints a warning naming it).
- **Routing.** With `rivetRouter` the page's root is one more such component: its props are the route's loader data, so the browser rebuilds the router and the current route from them without a data request, and links then navigate in the client as on the default model. Loader data may hold values JSON cannot (a `Date`, a `Map`, a `Set`, a `BigInt`, a `URL`, shared objects, instances of a class registered with `registerClass`); they reach the browser as the same values. A value Rivet cannot send (a function, a symbol, a promise, an instance of an unregistered class) prints a warning ([RV2107](../errors/RV2107.md)), and the page then renders in the browser instead of resuming.
- **Components are functions that return JSX.** A capitalised function returning a plain object (a renderer or factory) is not treated as a component.
- **Why it is off by default.** On the 1,000-row benchmark page (one request at a time) the page is smaller (24.0 KB brotli of HTML instead of 27.2 KB), the server peaks lower and each page now costs less server time than on the default model (about 0.7× the CPU per page at 1,000 rows, 0.5× at 5,000), but the first click still costs about as much or more: the page fetches its code ahead after load (38 KB, none of it run), and on that page the first row click shows after 15 ms instead of 14 ms, or 34 instead of 26 ms on a CPU four times slower (at 5,000 rows it is faster on the slower CPU: 57 ms instead of 77 ms). Pages whose root builds large collections (list boxes, tables) pay that build on their first click. Numbers: [derived model report](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-20-derived-r5.md), [server-side update](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-derived-s.md), [client numbers](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-21-derived-c.md) (section C2 for the latest).
- **What it does not do yet.** Streamed `Async` content is resumed when the `Async` has a fallback function, also inside a component's children or under a provider (the server's value is used, its `load` does not run again in the browser, and so it does not reload when something its load read changes; with `rivetRouter` a value JSON cannot hold, such as a `Date`, arrives as the same value). The [shell cache](../guides/routing/headers-and-caching.md#partial-prerendering-shell-cache) stores derived pages as it does others. `Suspense` content is awaited in place on the server; a component whose own `Suspense` content waits for a load (a `resource` or an `Async` in the same component) renders again in the browser the first time it is used (its loads run again; development prints a warning naming it). Framework bridges and forms are not covered; `resume.entry`, `chunks`, `merge`, `cap`, `lazy` and `preload` are ignored, and so are `lazyRows` and `domData` (rows of a `<For>` are always picked up lazily, and the route's loader data is sent in full even where the page already shows it); an edit in development reloads the page. A press before the code arrives is replayed as on the default model, but the hover state of the pressed element (`data-hovered`) can differ from a loaded page until the pointer moves, and some collection components (tag group, grid list, tree) still render again in the browser on their first interaction.

## What it means for your code

- **The component body runs once, on the server.** A `console.log` there prints in the terminal, never in the browser console. See [component did not run again](../gotchas/component-did-not-run-again.md).
- **Write browser behaviour as handlers or client effects.** `onClick`, `onInput`, `onSubmit`, `clientEffect` and `clientEvent` are the places where code runs in the browser.
- **Keep captures small and plain.** Capture an id, not a whole object with methods (in development, large ones warn: [large data in resume state](#large-data-in-resume-state)). A handler or binding that only reads members of a `const` object (`store.count`) captures just those members, so the object's other fields stay out of the page; using the object any other way (passing it, spreading it, calling one of its methods) captures it whole.
- **A captured `let` behaves like a JavaScript variable.** When a `let` is reassigned anywhere (in the component, a handler, another function or a class field), Rivet keeps it in one shared box: every handler sees the same value, and the page starts from the value it had when rendering finished. It is not reactive (use a signal to update the page). A handler passed by name (`onClick={h}`) stays the function `h` held when the JSX ran, as in the browser. `var`, destructured `let`s and loop variables (`for (let i …)`) are captured by value, and so is every `let` of a component that calls `eval`.
- **Values built in the component arrive as data.** A constant made by calling a function (`const columns = buildColumns()`, `const rows = items.map(…)`) is sent to the browser as it was when the page was sent; the browser does not call that function again. Changes made to the object later, while the rest of a streamed page is still loading, do not reach the browser. If a library function must run in the browser (to register a listener or a global), call it in `clientEffect`.
- **Components outside `src/routes` resume too.** `rivetRouter` resumes every `.tsx`/`.jsx` component file in your project that a route imports; no list needed. To opt out, set `resume: { appModules: false }` and list files in `resume.modules`.
- **The first mouse click updates the page one task later.** The handler runs during the click as usual; the DOM update of a page's first mouse click lands in the next task, because Chrome would otherwise hold the next frame. Tests that read the DOM right after that click must wait. See [batching](../guides/state/batching.md#the-first-mouse-click-on-a-page).
- **A press before its code arrives behaves like a loaded one.** When you press an element whose handler is still loading, the browser focuses it as usual; once the handler arrives, Rivet replays the press with the focus it would have seen, so a handler that keeps focus where it was (a radio label, a number field's step button) leaves you where a loaded page does, and a group around the element (a radio group tracking focus within) sees the same focus changes. When the press itself opens something under the pointer (a select's popover over its trigger), the release and the click land where they would on a loaded page. Same-page `#hash` links focus their target like any client navigation.
- **Dev resumes too.** The dev server serves pages resumable like production, until your first edit switches the page to rendering in the browser (for hot reload). Check speed with a production build. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Related

- [Loading code](loading-code.md): when and how the browser fetches each piece of code.
- [Signals](signals.md): how Rivet knows which part of the page to update.
- [Server first](server-first.md): what runs on the server and what in the browser.
