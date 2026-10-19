---
title: Coming from React, Solid, Svelte or Qwik
description: What maps to what when you know React, Solid, Svelte or Qwik, what works differently in Rivet, and the steps to move an existing app.
template: guide
status: experimental
related: [learn/resuming, learn/signals, guides/components/components, start/quick-start]
---

After this page you know which Rivet API replaces the one you use today, which habits from your framework you have to drop, and in which order to move an existing app.

## The one difference that matters

In Rivet a component function runs **once, on the server**. The browser never runs it again: it :term[resumes]{id=resumability} the page from the HTML and the state the server wrote into it. Only handlers (`onClick`, …) and client effects run in the browser, and only when they are needed. See [Resuming](../learn/resuming.md).

Three rules follow from it, whatever framework you come from:

- **Code in the component body is server code.** `window`, `document` and `localStorage` are not there. Put browser code in a handler or a `clientEffect`. See [browser-only code](../guides/components/browser-only.md).
- **What a handler uses must be data.** Signals, plain objects, arrays, `Date`, `Map`, `Set`, and functions written in your components (local `const` functions, inline callback props such as `onSave={() => …}`) work. Module-level functions passed directly as props work too. Class instances, functions from libraries, and functions stored in objects or arrays do not. See [serializable captures](../best-practices/serializable-captures.md).
- **Props are live, as in Solid.** `<Badge count={count()} />` updates the child when `count` changes, because the compiler passes a getter. Read `props.count` where it is shown; destructuring props reads once. See [components](../guides/components/components.md#props-are-live).

## From React (and Next.js, Remix)

| React | Rivet |
| --- | --- |
| `const [n, setN] = useState(0)` | `const n = signal(0)`; read `n()`, write `n.set(1)` or `n.update((v) => v + 1)` |
| `useMemo(() => a * 2, [a])` | `computed(() => a() * 2)` (no dependency list) |
| `useEffect(() => …, [deps])` | `clientEffect(() => …)` from `@rivetjs/runtime/dom` (re-runs when the signals it reads change) |
| `useRef()` for an element | `ref()` and `ref={el}`; see [refs](../guides/components/refs.md) |
| `createContext` / `useContext` | `createContext` / `useContext` from `@rivetjs/reactivity`; see [context](../guides/components/context.md) |
| `{items.map((i) => <li key={i.id}>…)}` | `<For each={items} by={(i) => i.id}>` for lists that change; see [lists](../guides/components/lists.md) |
| `cond && <p />` | `cond() && <p />` (read the signal); see [conditional content](../guides/components/conditional.md) |
| `className`, `onChange` on inputs | `class` (`className` also works), `onInput`, or `model:value={signal}` |
| `React.lazy`, `<Suspense>` | `lazyComponent`, `Async` and `Suspense` from `@rivetjs/runtime/dom` |
| Next.js `app/` folders, Remix routes | `src/routes` files; `_layout.tsx` for layouts; see [file routes](../guides/routing/file-routes.md) |
| `getServerSideProps`, Remix `loader` | `export const serverLoad` in the page file |
| Server actions, Remix `action` | `export const serverActions` in the page file |
| `useRouter().push`, `useSearchParams` | `navigate()`, `useSearchParams()` / `setSearchParams()` from `@rivetjs/router/client` |

What to unlearn:

- **There are no re-renders.** A state change updates only the text, attribute or list row that reads the signal. The component function does not run again, so there is nothing to memoize and no `useCallback`.
- **Hooks rules do not apply.** `signal()` and `computed()` can be created anywhere: in a condition, in a module, in a plain function.
- **No hydration.** React downloads and runs every component in the browser before the page reacts. Rivet loads the code of a handler when you are about to use it.

You do not have to convert everything at once: React 19 and Preact components can stay as they are and run inside Rivet pages as islands. See [React and Preact components](../guides/components/framework-components.md).

## From Solid (and SolidStart)

Solid's model is the closest: signals, components that run once, fine-grained updates.

| Solid | Rivet |
| --- | --- |
| `const [n, setN] = createSignal(0)` | `const n = signal(0)`: one function to read, with `.set` and `.update` |
| `createMemo` | `computed` |
| `createSelector` | `selector`: same per-key subscriptions, plus an optional `keys` hint (compare only the keys that may have changed) |
| `createEffect` | `clientEffect` in components (browser), `effect` outside them |
| `onCleanup`, `batch`, `untrack`, `createRoot` | same names, from `@rivetjs/reactivity`. One difference: a Rivet `createRoot` belongs to the scope it is created in and is disposed with it (Solid's roots are detached); create it outside any scope for an independent lifetime |
| `<For each={items()}>` | `<For each={items()} by={(i) => i.id}>`: same, plus a key |
| `<Show when={…}>` | `cond() && <p />`, a ternary, or `<Show when={cond()}>` |
| `createResource` | `serverLoad` for page data, `Async` for parts that load later |
| SolidStart `"use server"` | `server…` exports next to the page, or `*.server.ts` files |

What differs: Solid hydrates, so in the browser your components run once more. In Rivet they do not, which is why captured values must be serializable and why browser code must be in handlers and `clientEffect`. As in Solid, destructuring props reads them once: use `props.x`, `mergeProps` and `splitProps` from `@rivetjs/runtime/props`.

## From Svelte (and SvelteKit)

| Svelte | Rivet |
| --- | --- |
| `let n = $state(0)` | `const n = signal(0)`; read `n()` |
| `$derived(a * 2)` | `computed(() => a() * 2)` |
| `$effect(() => …)` | `clientEffect(() => …)` |
| `{#each items as item (item.id)}` | `<For each={items} by={(item) => item.id}>` |
| `{#if …}{:else}{/if}` | a ternary in JSX |
| `bind:value={name}` | `model:value={name}` |
| `<slot />`, snippets | `children`, [slots](../guides/components/slots.md) |
| `+page.svelte` | `src/routes/<path>.tsx` |
| `+page.server.ts` `load` / `actions` | `serverLoad` / `serverActions` in the same `.tsx` file (or a sibling `*.server.ts`) |
| `+layout.svelte` | `_layout.tsx` |
| `hooks.server.ts` `handle` | `onRequest` in a layout, `serverGuard` for access checks; see [guards](../guides/routing/guards.md) |
| `<style>` in the component | `css` blocks ([scoped styles](../guides/styling/scoped-styles.md)) or Tailwind |

What differs: components are TypeScript JSX, not a template language, and state is explicit (`signal`, not compiler-tracked `let`). SvelteKit hydrates every page; Rivet resumes it.

## From Qwik (and Qwik City)

Qwik also resumes. The main change is that Rivet needs no `$` markers: the compiler finds the code that must run in the browser.

| Qwik | Rivet |
| --- | --- |
| `component$(() => …)` | a plain function component |
| `useSignal(0)`, `.value` | `signal(0)`; read `n()`, write `n.set(…)` |
| `useStore({ … })` | `createStore` from `@rivetjs/reactivity/store`; see [stores](../guides/state/stores.md) |
| `useComputed$` | `computed` |
| `useVisibleTask$`, `useTask$` | `clientEffect(fn, { when: … })`; see [effects](../guides/state/effects.md) |
| `onClick$={…}` | `onClick={…}` |
| `routeLoader$` | `serverLoad` |
| `routeAction$`, `<Form>` | `serverActions` and a plain `<form method="post">`, or [`@rivetjs/forms`](../guides/forms/forms.md) |
| `server$` | an endpoint (`routes/api/x.ts` with `onPost`) or an action |

The serialization rules feel familiar: what a handler captures is written into the page. Rivet keeps them in one place: inline arrows and local `const` functions in the component are fine, also when they reach a child as props; so are module-level functions passed directly as props; class instances and functions Rivet did not compile (libraries, functions stored in objects or arrays) are not; a `.bind(…)` of a compiled function is fine inline in a prop or in a local constant, not written inside an object literal.

## Reading without subscribing

Every signal library has a way to read a value without making the current computed or effect depend on it. In Rivet it is always `untrack`, for signals and computeds alike:

| Library | Untracked read | Rivet |
| --- | --- | --- |
| Preact signals | `count.peek()` | `untrack(count)` |
| Vue | `toRaw(state)` for the raw object, or a read outside the effect | `untrack(count)` or `untrack(() => …)` |
| Solid | `untrack(count)` | `untrack(count)`: same name and behaviour |
| Angular signals | `untracked(count)` | `untrack(count)` |

## Move an existing app

1. **Start from a starter.** `npm create rivet@latest` with the `server` template (pages per request) or `static` (prerendered). See [quick start](quick-start.md).
2. **Move the routes.** One file per URL in `src/routes`, layouts as `_layout.tsx`, params as `[name]`. See [file routes](../guides/routing/file-routes.md).
3. **Move data loading to the server.** Put fetches that ran in effects or loaders into `serverLoad` next to the page, and mutations into `serverActions`. Pages get the result as `data`.
4. **Convert components.** State to `signal` / `computed`, effects that touch the browser to `clientEffect`, lists to `<For>`. Keep handlers as inline arrows or local `const` functions. React or Preact components you are not converting yet can stay as [islands](../guides/components/framework-components.md): rename them to `*.react.tsx` and add `react()` to `bridges`.
5. **Keep shared components in the project.** Components outside `src/routes` resume without being listed: `rivetRouter` resumes every app component file a route imports.
6. **Run the checks.** `npm run check` (`rivet-check`) reports what cannot resume, such as a class instance captured by a handler, or a browser global read during server rendering. The [language service](../guides/tooling/language-service.md) shows the same errors in your editor.
7. **Measure a build, not dev.** `npm run build` and serve the result. See [dev and production differ](../gotchas/dev-and-production-differ.md).

## See also

- [What is Rivet](what-is-rivet.md)
- [Resuming](../learn/resuming.md): how the browser continues the server's page.
- [Signals](../learn/signals.md): how updates reach exactly the right node.
- [Coming from another signal library](../learn/signals.md#coming-from-another-signal-library): effect timing, errors, equality and cycles compared with Preact, Solid, Angular and TC39 signals.
