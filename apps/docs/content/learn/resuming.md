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
- The **browser** gets the HTML, the saved state and a small loader script (about 1.8 KB compressed). When you use the page, it loads only the code for what you touched and continues with the saved state.

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

3. **A list: keyed `For` rows.** Render the rows with [`<For each={…} by={…}>`](../guides/components/lists.md) so each row's handler captures its own item, instead of one handler capturing the whole list. By default each row still ships its item and its own handler and binding records; [lazy rows](#lazy-rows-experimental), an experimental opt-in, cut a row to its key.
4. **A library object** (a chart, an editor, an SDK client): build it with [`reconstruct`](#library-objects-reconstruct). The browser builds it on first use; nothing about it ships.

### Lazy rows (experimental)

Lazy rows are off by default. With them on, a keyed `<For>` writes no resume records for its rows: the page ships the list's items once and each row as its key, and the browser rebuilds a row from the server HTML when it is first used (its first event, or the first change of a signal it reads). No node is replaced, so focus and typed values stay. Turning them on takes two switches:

1. **The build option** `resume: { lazyRows: true }` on `rivetRouter(…)` (or `rivet(…)`) in `vite.config.ts`. It adds the code that rebuilds rows to that build's browser runtime (about 2.8 KB brotli). Builds without it contain none of that code.
2. **The server environment variable** `RIVET_LAZY_ROWS=on`, read on every render. Without the build option the variable does nothing (development prints a warning); with the option but without the variable, rows are recorded as usual. Build once with the option and switch the variable to compare.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { lazyRows: true } })],
});
```

- **Not every list qualifies.** The compiler decides per `<For>`: for example the row must be an inline function, `by` a key path such as `(row) => row.id` or an inline function, and the list must not spread props onto the `<For>`, read render props in a row or use values that change between renders (`Date.now()`, `Math.random()`). A row that renders a `Portal`, `clientOnly`, `Async` or `Suspense` content turns the whole list back to recorded rows; development prints a warning naming the reason.
- **Why it is off by default.** A signal every row reads, such as a selection, wakes every row when it first changes, so the first select-all or row click rebuilds all rows of the list at once.

## What it means for your code

- **The component body runs once, on the server.** A `console.log` there prints in the terminal, never in the browser console. See [component did not run again](../gotchas/component-did-not-run-again.md).
- **Write browser behaviour as handlers or client effects.** `onClick`, `onInput`, `onSubmit`, `clientEffect` and `clientEvent` are the places where code runs in the browser.
- **Keep captures small and plain.** Capture an id, not a whole object with methods (in development, large ones warn: [large data in resume state](#large-data-in-resume-state)). A handler or binding that only reads members of a `const` object (`store.count`) captures just those members, so the object's other fields stay out of the page; using the object any other way (passing it, spreading it, calling one of its methods) captures it whole.
- **A captured `let` behaves like a JavaScript variable.** When a `let` is reassigned anywhere (in the component, a handler, another function or a class field), Rivet keeps it in one shared box: every handler sees the same value, and the page starts from the value it had when rendering finished. It is not reactive (use a signal to update the page). A handler passed by name (`onClick={h}`) stays the function `h` held when the JSX ran, as in the browser. `var`, destructured `let`s and loop variables (`for (let i …)`) are captured by value, and so is every `let` of a component that calls `eval`.
- **Values built in the component arrive as data.** A constant made by calling a function (`const columns = buildColumns()`, `const rows = items.map(…)`) is sent to the browser as it was when the page was sent; the browser does not call that function again. Changes made to the object later, while the rest of a streamed page is still loading, do not reach the browser. If a library function must run in the browser (to register a listener or a global), call it in `clientEffect`.
- **Components outside `src/routes` resume too.** `rivetRouter` resumes every `.tsx`/`.jsx` component file in your project that a route imports; no list needed. To opt out, set `resume: { appModules: false }` and list files in `resume.modules`.
- **The first mouse click updates the page one task later.** The handler runs during the click as usual; the DOM update of a page's first mouse click lands in the next task, because Chrome would otherwise hold the next frame. Tests that read the DOM right after that click must wait. See [batching](../guides/state/batching.md#the-first-mouse-click-on-a-page).
- **A press before its code arrives behaves like a loaded one.** When you press an element whose handler is still loading, the browser focuses it as usual; once the handler arrives, Rivet replays the press with the focus it would have seen, so a handler that keeps focus where it was (a radio label, a number field's step button) leaves you where a loaded page does. Same-page `#hash` links focus their target like any client navigation.
- **Dev resumes too.** The dev server serves pages resumable like production, until your first edit switches the page to rendering in the browser (for hot reload). Check speed with a production build. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## Related

- [Loading code](loading-code.md): when and how the browser fetches each piece of code.
- [Signals](signals.md): how Rivet knows which part of the page to update.
- [Server first](server-first.md): what runs on the server and what in the browser.
