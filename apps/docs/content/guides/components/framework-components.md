---
title: Framework components
description: Use React, Preact, Solid, Vue and Svelte islands with server rendering, client policies, live props and resumable Rivet slots.
template: guide
status: experimental
related: [guides/components/browser-only, guides/components/slots, guides/performance/chunks, reference/config]
---

A framework bridge lets you use components written for another framework as JSX tags in a Rivet page. The component renders on the server through that framework's own SSR, straight into Rivet's HTML stream, and starts in the browser only when its `client` policy says so. Everything around it stays Rivet: compiled, resumable, and free of JavaScript until someone interacts. After reading this page you can add framework components to a Rivet app, choose when each one loads, pass it live values and callbacks, and put Rivet content inside it.

:::note
Bridges are experimental. Adapters support React 19, Preact 10.29+/11, Solid 1.9, Vue 3.5 and Svelte 5.57.2+. Each island has its own framework root; context and stores created in that root stay local to it.
:::

## Install

```sh
npm install @rivetjs/bridge @rivetjs/bridge-react react react-dom
```

`@vitejs/plugin-react` 6 is optional: install it for React Fast Refresh and the React Compiler, and the bridge adds it for its own files. Without it, Vite compiles React JSX by itself.

For Preact: `npm install @rivetjs/bridge @rivetjs/bridge-preact preact preact-render-to-string` (`@preact/preset-vite` is the optional plugin).

## Configure Vite

Pass the bridge to `rivetRouter()`:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { react } from "@rivetjs/bridge-react/vite";

export default defineConfig({
  plugins: [rivetRouter({ bridges: [react()] })],
});
```

Without the file router, `rivet({ bridges: [react()] })` from `@rivetjs/compiler/vite` takes the same list. Bridges work in `server` and `static` mode. `preact()` from `@rivetjs/bridge-preact/vite` works the same way, and all adapters can be in one list.

## Solid, Vue and Svelte

Install the adapter, framework and its native Vite plugin:

```sh
npm install @rivetjs/bridge @rivetjs/bridge-solid solid-js@^1.9 vite-plugin-solid@^2.11
npm install @rivetjs/bridge @rivetjs/bridge-vue vue@^3.5 @vitejs/plugin-vue@^6
npm install @rivetjs/bridge @rivetjs/bridge-svelte svelte@^5.57.2 @sveltejs/vite-plugin-svelte@^7.3.1
```

Choose the packages you need. Configure their factories together:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { solid } from "@rivetjs/bridge-solid/vite";
import { vue } from "@rivetjs/bridge-vue/vite";
import { svelte } from "@rivetjs/bridge-svelte/vite";

export default defineConfig({
  plugins: [rivetRouter({ bridges: [solid(), vue(), svelte()] })],
});
```

Import each adapter's `types` once, then import components from their native files:

```tsx
import "@rivetjs/bridge-solid/types";
import "@rivetjs/bridge-vue/types";
import "@rivetjs/bridge-svelte/types";
import { Counter } from "../components/Counter.solid.tsx";
import Card from "../components/Card.vue";
import Chart from "../components/Chart.svelte";

export default function Dashboard() {
  return <main><Counter client="load" /><Card client="idle" /><Chart client="visible" /></main>;
}
```

Solid owns `*.solid.tsx` / `*.solid.jsx`; start its JSX files with `/** @jsxImportSource solid-js */` for TypeScript. Vue owns `.vue`; Svelte owns `.svelte` and rune modules `.svelte.ts` / `.svelte.js`. The adapters add their native compilers; Rivet does not compile the foreign component's markup. Configure the native framework's editor support for SFC imports. Solid 2 is a separate API and is not supported by this adapter. Rivet uses separate event metadata, including for precompiled Solid dependencies.

Vue setup runs once for each app on both server and client. To install plugins or provide dependencies, pass a module path:

```ts
vue({ setup: "./src/vue-setup.ts" });
```

```ts title="src/vue-setup.ts"
import type { App } from "vue";
export default function setup(app: App) {
  app.provide("currency", "USD");
}
```

Create request-specific state inside this hook rather than sharing it between requests. The programmatic server/client APIs also export `createAdapter({ setup })`.

Vue and Svelte scoped CSS from the island's static dependency graph is linked during server rendering, including static islands without JavaScript. Vue also reports native async SFC modules actually rendered on the server, so their CSS loads without eagerly loading unrelated lazy views. Async island output inside Rivet `Suspense` emits newly discovered stylesheet links before the streamed payload.

For Svelte experimental async SSR, import styled child components statically when they must be styled before JavaScript. CSS used only by a runtime `await import("./Child.svelte")` is outside the static closure and loads with the client import; Svelte exposes no public rendered-module collector.

### Native head ownership

Install `@rivetjs/kit` and add `kit()` from `@rivetjs/kit/vite` to the Vite plugins to collect adapter head output. The router then holds the document head until component head is ready. Without this sink, adapter head output is dropped with a development warning.

Vue `Teleport to="head"` and Svelte `<svelte:head>` keep their native SSR anchors so hydration reuses the original metadata nodes. They must finish before the document head is released: native head discovered after the head hold fails explicitly. Move that metadata into Rivet Kit or resolve the head-producing island before streaming its body.

Use one native title author per document. Its title can replace a lower-priority route/default title; multiple native titles, a competing higher-priority title or a `titleTemplate` fail explicitly. Keep route-wide title composition in Kit. Native head nodes belong to the island. Pages with native head include a small nonce-bearing lifecycle script that removes those nodes when their original island root leaves the document, including static islands and islands that have not hydrated. Roots moved within the document keep their head. Other static islands still need no JavaScript. Vue head hydration uses a guarded Vue 3.5 Teleport cursor contract; rerun adapter tests before upgrading Vue.

## Which files are React

Rivet and React both use JSX, so every file has exactly one owner. React owns:

- files named `*.react.tsx` or `*.react.jsx`,
- files that start with a `/** @jsxImportSource react */` comment,
- folders and npm packages you list in `react({ include: ["src/react/**", "@mui/material"] })`.

`exclude` takes the same patterns and wins over everything else. Every other `.tsx` file is Rivet. A file that both Rivet and a bridge claim stops the build with `RV2145`. Preact uses `*.preact.tsx`, `@jsxImportSource preact` and `preact({ include })`.

The file name is a build rule only. TypeScript and your editor read the JSX import source from `tsconfig.json`, which names Rivet's for the whole project, so start every React file with the pragma to type-check it as React:

```tsx title="src/components/RevenueChart.react.tsx"
/** @jsxImportSource react */
```

For Preact files, the pragma is `/** @jsxImportSource preact */`. Then import each adapter's JSX types once anywhere in the project:

```ts
import "@rivetjs/bridge-react/types";
import "@rivetjs/bridge-preact/types";
```

Then a React or Preact component used in a Rivet file is type-checked with its own props, plus the island options below. Without the types import, `client` on that component is a type error; without the pragma, the component's own JSX is.

## Use a component

Write the React component as usual:

```tsx title="src/components/RevenueChart.react.tsx"
/** @jsxImportSource react */
import { Bar, BarChart, XAxis, YAxis } from "recharts";

export function RevenueChart(props: { data: { month: string; paid: number }[] }) {
  return (
    <BarChart width={640} height={260} data={props.data}>
      <XAxis dataKey="month" />
      <YAxis />
      <Bar dataKey="paid" isAnimationActive={false} />
    </BarChart>
  );
}
```

Import it in a Rivet route and render it like any component:

```tsx title="src/routes/index.tsx"
import "@rivetjs/bridge-react/types";
import type { PageProps } from "@rivetjs/router";
import { RevenueChart } from "../components/RevenueChart.react.tsx";
import { load } from "@rivetjs/router";

export const loader = load(() => ({ revenue: [{ month: "Jan", paid: 120 }, { month: "Feb", paid: 180 }] }));

export default function Overview({ data }: PageProps<typeof loader>) {
  return (
    <main>
      <h1>Overview</h1>
      <RevenueChart client="visible" data={data.revenue} />
    </main>
  );
}
```

React renders the chart on the server (`renderToString`, or its streaming API when something suspends), so the HTML arrives with the page. When the chart comes within about one screen height of the viewport, the browser downloads React and the component; once the chart is visible, it hydrates. A visitor who never scrolls down downloads nothing for it. Without a `client` prop, an island stays static HTML and ships no JavaScript at all.

## When it starts: client

| `client` | The island hydrates |
| --- | --- |
| none | never: static HTML. With a live prop, on the first change of that prop |
| `"load"` | right after the page is ready |
| `"idle"` | when the browser is idle |
| `"visible"` | when it scrolls into view; its code downloads when it is about one screen height away |
| `"interaction"` | on the first pointer down or key press anywhere on the page |
| `"intent"` | on hover, focus or touch of the island; a click during loading is replayed once after hydration |
| `"media:(max-width: 600px)"` | when the media query matches |
| `"only"` | not rendered on the server: the `fallback` shows until the component mounts in the browser |

Options use an object: `client={{ on: "visible", rootMargin: "200px" }}` (download and hydrate once the island is within 200px of the viewport) or `client={{ on: "idle", timeout: 500 }}`. `preload` has no effect: Rivet downloads island code ahead of its trigger on its own: after the page has painted for `load`, `idle` and `only`, near the viewport for `visible`. A per-island `preload` setting is not available yet ([roadmap](../../about/roadmap.md#in-progress)).

If you know Astro: `client="visible"` is `client:visible`, written as a normal prop so it is typed and can take options.

## Props are live

Pass values, not signals. A prop that reads a signal follows it: each Rivet update re-renders the island once, through the framework's own update mechanism.

```tsx
import { signal } from "@rivetjs/reactivity";

const range = signal("30d");
<RevenueChart client="idle" data={series(range())} />;
```

A static island (no `client`) with a live prop loads nothing until the prop changes. On the first change it hydrates with the old values, so the HTML matches, and then renders the new ones. Passing the signal itself (`count={count}`) passes a function, which the framework sees as a callback.

`client`, `preload` and `fallback` are read once and never reach the component.

## Callbacks into Rivet

A function prop calls back into Rivet. Write it as an ordinary function, as for any [event handler](events.md). The enclosing component rebuilds it during adoption:

```tsx
import { signal } from "@rivetjs/reactivity";

const range = signal("30d");
<RangePicker client="load" value={range()} onChange={(next) => range.set(next)} />;
```

The call runs as one Rivet batch: when React's `onChange` returns, the Rivet DOM around the island already shows the new value. A callback that throws goes to the nearest Rivet error handler; if nothing handles it, React gets the error.

## Rivet content inside React

Props typed as `ReactNode`, `children` included, accept Rivet content. React renders an empty hole there, and Rivet writes its own HTML into it:

```tsx
<Card client="load" title={<b>Revenue</b>}>
  <p>
    Rivet content inside React: <button onClick={() => range.set("30d")}>Reset</button>
  </p>
</Card>
```

That content stays Rivet's. It resumes like the rest of the page, its handlers work before and after React hydrates (a click that arrives before the page's code has loaded is held and runs once it has), and React re-renders keep the same nodes. A React island can sit inside another island's slot: the inner one hydrates first and keeps its root when the outer one updates.

Render props (a slot that React calls with arguments) are not supported. Use a callback and a live prop instead.

## Errors

- **On the server**, a component that throws renders its `fallback` prop when it has one. Without one, the error (`RV2144 react island … failed to render`) goes to the nearest [error boundary](error-boundaries.md).
- **In the browser**, a hydration mismatch makes React render the island again on the client, and the console shows `RV2149` with the island id.
- **If the island's code fails to load** (offline, a new deploy), the server HTML stays and the console shows one error.

## Development

`npm run dev` starts islands like a production build: by their `client` policy, through the inline script or the Rivet component that renders them. With `@vitejs/plugin-react` installed, the router adds its Fast Refresh preamble to every dev page.

## Pages with only islands

When a page's only browser code is islands with plain JSON props, Rivet skips its own loader and runtime. The page gets a list of the islands and a small inline script that starts each one by its policy. On file-router pages the router waits until the first link hover, focus or click.

On other pages, too, every island with plain JSON props starts through that inline script. An island that needs Rivet (live props, callbacks, Rivet content in a slot, `client="intent"`) starts with the Rivet component that renders it: that component loads when the island's policy fires (`load`, `idle`, `visible`), takes over the server HTML and then hydrates the island. Rivet content in its slots renders again in the browser at that moment; an event held on the server's nodes runs on the new ones. A `visible` island of this kind still downloads its code near the viewport, not before. An island that needs Rivet but is rendered outside any interactive component stays static (development prints a warning naming it). See [Resuming](../../learn/resuming.md).

## Write an adapter

An adapter connects one framework to the bridge. `@rivetjs/bridge/adapter` holds the contract the framework adapters implement; the API may still change while bridges are experimental. An adapter package has three modules:

- **A server module** that exports `adapter: ServerAdapter`. `render(component, props, slots, ctx)` returns the island's HTML (a string, `{ html, head }` for hoisted head entries, or a promise). Each `slots[name].html` is the exact empty element to write where Rivet content goes. `ctx.id` is the island id, to use as the framework's id prefix; `ctx.nonce` is the page's CSP nonce. `head(ctx)` (optional) returns markup written once per page before the first island of that framework.
- **A client module** that exports `adapter: ClientAdapter`, with `hydrate` (start on the server HTML), `mount` (client-only islands, and after a failed hydration), `update(handle, props)` for live props and `unmount(handle)`. When the framework throws the server HTML away, call `islandRecovered(framework, id, error, root)`: it logs `RV2149` with the island id and, in development, shows the error in DevTools.
- **A Vite entry** that returns a `BridgeEntry` for `rivet({ bridges: [...] })`: `name`, the `server` and `client` module specifiers, `owns(id, source)` and `specifiers` (which files and npm packages belong to the framework; `ownership()` from `@rivetjs/bridge/vite` builds them from file suffixes, `@jsxImportSource` pragmas and `include` / `exclude`), `plugins()` (the framework's own Vite plugins), and optionally `dedupe` and `optimize`.

`defineAdapter(adapter)` returns its argument unchanged; it only types the object. Read `@rivetjs/bridge-preact` for a small complete adapter.

## Common mistakes

- **Writing React JSX in a plain `.tsx` file.** Rivet then compiles it as Rivet JSX and fails. Rename the file to `*.react.tsx`, add the pragma, or list the folder in `include`.
- **Expecting clicks before hydration to work.** Events inside an island that has not started yet are lost. `intent` replays a press that arrives before the island has started (also before Rivet's own runtime has started on the page) once after hydration. Pick `load` for controls people press right away.
- **Many small islands.** Each island is its own React root that hydrates on its own. Islands on one page share one copy of React, and download that framework's runtime too. Make islands wide (a whole table, a whole form), not one per button.
- **Running the production server without `NODE_ENV=production`.** React then renders with its development build: slower, with development warnings. The starters' `serve.js` sets it unless you set it yourself; see [Node.js](../deploy/node.md#start-the-server).
- **Sharing React context between islands.** Each island is a separate root, so React context does not cross from one island to another, and Rivet context does not reach React.
- **Stopping propagation in React.** `stopPropagation` in a React handler stops the event at the island, so Rivet handlers above it do not run.

## See also

- [Browser-only code](browser-only.md)
- [Slots](slots.md)
- [Chunks](../performance/chunks.md): inspect island modules and their shared framework dependencies.
- [Config](../../reference/config.md): the `bridges` option.
- [Bridges demo benchmark](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-12-bridges-demo.md): a React dashboard on Next 16 and inside Rivet.
