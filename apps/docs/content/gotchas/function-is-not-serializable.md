---
title: Function is not serializable
description: Why a handler that uses a function Rivet cannot rebuild, or a class instance, fails to render, and how to fix it.
template: gotcha
related: [best-practices/serializable-captures, best-practices/pass-data-not-services, learn/resuming]
---

## What you see

The production build or the prerender step fails while it renders a page:

```txt
Cannot resume src/components/Price.tsx#Price$k3xq9a: function is not serializable
```

On the dev server (`vite serve`) the message names the capture, for example ``capture `format` function is not serializable``, and the error overlay shows where it is declared. A development build (`NODE_ENV=development vite build`) gives its position instead (`capture #1`). Both also say where the value came from and what to do:

```txt
… function is not serializable — only functions created in a resume-compiled component (a module in resume.modules, or any app component module under `rivetRouter`) or its module scope resume; pass data, or move the function into such a module; a library object holding functions (a chart, socket, editor): build it with reconstruct(() => …)
```

Production builds say the same in short: `function is not serializable: build it inside the component, or a library object with reconstruct(() => …)`.

For class instances you get `Robot instance is not serializable` (with your class name), followed by the fixes: `reconstruct(() => new Robot(…))` or a `static [revive]` for your own class, `registerClass(Robot, { id, serialize, revive })` for a package class. Built-ins such as `Promise` keep the short message. If the `new` call is inside the component (and is not one of the built-ins below or a data class, see below), the compiler already stops with:

```txt
Resumable code cannot capture `d`: class instances are not serializable
```

A class declared in a component module (a `.tsx` file Rivet resume-compiles) is a **data class** when its instances hold only plain fields. Its instances resume: the browser gets an object of that class with the same fields, and its methods work. The constructor does not run again in the browser. The compiler stops with an error instead (code RV2102) when the class cannot resume this way, and names the field:

```txt
Cannot resume `conn.live`: Conn instance holds a resource (its field reads `window`); create it inside the handler, build it with reconstruct(() => new Conn(…)) or give Conn a static [revive]
```

That happens when the class has a `#private` field or method, an `accessor` field or a decorator, has a field arrow that uses `super`, extends a class that is not a data class of the same module (`Map`, `Error`, a package's class), or reads `window`, `document`, `localStorage`, `WebSocket` and similar while it is constructed. Two cases are not caught at compile time: a field set from a function call of another module (`pool = createPool()`) stops the render when its value is not serializable, and a field set from a module value computed with `typeof window` keeps the value the server had (`null`), because the constructor does not run again. Create such an object inside the handler (or a `clientEffect`) instead of capturing it, build it with `reconstruct(() => new Conn(url))` (the page carries no value; the browser runs the factory the first time a handler reads it, see [library objects](../learn/resuming.md#library-objects-reconstruct)), or let the class rebuild itself: `[serialize]()` returns its data and `static [revive](data)` builds a new instance in the browser (package classes: `registerClass`). See [resource holders and package classes](../learn/resuming.md#resource-holders-and-package-classes). A class with `[serialize]()` but no `static [revive]` stops the render with:

```txt
RV2102: Conn has [serialize] but no static [revive]
```

## Why

An event handler runs in the browser, but the component that made it ran on the server. Every value the handler uses from the component (a prop, a local variable) is a "capture". The server writes each capture into the page as data, so the browser can rebuild the handler later.

Only :term[serializable]{id=serializable} values can go into the page: strings, numbers, booleans, `null`, plain objects and arrays, `Date`, `Map`, `Set`, `URL`, `URLSearchParams`, `RegExp`, `ArrayBuffer`, `DataView`, typed arrays (`Uint8Array`, …), `Error` and its built-in subclasses, `bigint`, and signals that hold such values. An instance of your own class is data only when the class is a data class of a component module (see above); classes from `.ts` files and packages are not.

Rivet can also rebuild functions it compiled itself, in a resume-compiled module:

- a function defined inside a component or hook, as a constant (`const onSave = () => …`) or a function declaration;
- a function written inline where it leaves the function that made it: a prop (`onChange={(v) => …}`), a value in an object (`{ onKeyDown: (e) => … }`), a `return` value, or an argument to one of your own helper functions;
- a function written inline or stored by name into a value a handler uses: assigned to it or to one of its properties (`api.inc = () => …`, `api.open = open`), added with `push` / `unshift` / `splice` / `fill` / `set` / `add` (`list.push(open)`, `map.set("k", open)`), or passed to a call / `new` / array / object in its initializer (`signal(() => …)`, `[() => …]`, `new Map([["k", () => …]])`) — not callbacks a call only runs or schedules (`items.map((x) => …)`, `setTimeout(() => …)`); Rivet decides this by the method or function name (`map`, `then`, `setTimeout`, …), so a method of your own with such a name that keeps its callback leaves it plain;
- a default value in destructuring: `function Field({ format = (v) => v })` or `const { onSave = () => {} } = props`;
- a function child, also with a block body: `{() => { const n = count(); return <b>{n}</b>; }}`;
- a function defined at the top of the module, or imported, when a handler calls it directly, when it is passed as a prop (`<Price format={formatEuro} />`), when a constant in the component refers to it (`const format = formatEuro;`), or when the component puts it in an object, an array or a call argument (`{ format: formatEuro }`, `[formatEuro]`, `useFormat(formatEuro)`) — the page then refers to the module's own function, also for npm imports.

Such a function can travel through props, objects and signals. Rivet cannot rebuild a function that it did not compile this way: one created at runtime by code that is not resume-compiled (a library's `memoize(fn)` result), one that only code outside a component puts into a value (an object built at module level, `const table = { format: formatEuro }`, or one returned by your own hook or helper function: `function useFormat() { return { format: formatEuro }; }`), a `.bind(…)` written inside an object literal or spread (keep it in a local constant first: `const inc = add.bind(null, 2)` resumes wherever `inc` is used by name, and an inline `.bind` resumes directly in a prop or handler, when `add` is a function Rivet compiled), a method (`{ save() {} }`), a function that uses `this` (also with `.bind(ctx)`: still RV2007).

## Fix

Write the function where Rivet compiles it (inline, or as a constant in the component), or pass data and keep the logic in the module that uses it.

```tsx title="src/components/Price.tsx"
import { signal } from "@rivetjs/reactivity";

// Module level: the handler calls it directly, so it can run in the browser.
const format = (currency: string, value: number) => `${value} ${currency}`;

export function Price({ currency }: { currency: string }) {
  const amount = signal(1);
  const label = signal(format(currency, 1));
  return (
    <button
      onClick={() => {
        amount.set(amount() + 1);
        label.set(format(currency, amount()));
      }}
    >
      {label()}
    </button>
  );
}
```

```tsx title="src/routes/index.tsx"
import { Price } from "../components/Price.tsx";

export default function Page() {
  return <Price currency="EUR" />; // data: Price keeps the formatting logic
}
```

For a library object that holds functions (a chart, editor or socket client from a package), build it with `reconstruct(() => createChart(…))` from `@rivetjs/runtime/dom`: the page carries no value, the browser runs the factory on first read. See [library objects](../learn/resuming.md#library-objects-reconstruct).

For class instances, pass the plain data the class holds (for example `{ id, name }`) and create the instance inside the handler if you need it.

:::note
The dev server renders pages through the same recorder as production, so `vite` dev shows this error too: in the error overlay, with the component, its file and line, and the name of the captured value. See [Dev and production differ](dev-and-production-differ.md) for what still differs.
:::

:::note
`rivetRouter` resumes every app `.tsx`/`.jsx` component file a route imports. With `resume: { appModules: false }`, a file outside `src/routes` resumes only if listed in `resume.modules`. See [config](../reference/config.md).
:::
