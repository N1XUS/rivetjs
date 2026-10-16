---
title: Capture only serializable values
description: Handlers and effects may only use values that can be written into the page as data; know which types work and how to fix the ones that do not.
template: best-practice
related: [gotchas/function-is-not-serializable, learn/resuming, best-practices/pass-data-not-services, best-practices/state-close-to-use]
---

**Everything a handler, effect or computed value uses from its component must be plain data, a signal, or a function Rivet compiled. Keep class instances, promises and outside functions out of them.**

## Why

A handler is written on the server and runs in the browser. The variables it uses from the component around it are its **captures**. Rivet writes each capture into the page as data, so the browser can rebuild the handler without running the component again. A value that can be written as data and read back is **serializable** (see :term[serializable]{id=serializable}).

What works:

| Works | Does not work |
|---|---|
| strings, numbers, booleans, `null`, `undefined`, `bigint`, `NaN` | functions created at runtime by code Rivet did not compile (a library's `memoize(fn)` result), `.bind(…)` written inside an object literal (a local `const inc = add.bind(null, 2)` of a compiled function resumes wherever `inc` is used by name; an inline `.bind` resumes in a prop or handler), `.bind(ctx)` of a function using `this` (still RV2007), methods, and objects that hold functions built outside a component — at module level (`const table = { format: formatEuro }`) or by your own hook or helper (`function useFormat() { return { format: formatEuro }; }`) |
| plain objects and arrays (also shared or circular) | class instances (`new Api()`, `new Intl.NumberFormat()`), except data classes |
| `Date`, `URL`, `URLSearchParams`, `Map`, `Set`, `RegExp`, typed arrays, `ArrayBuffer`, `DataView`, `Error` | `Promise`, `WeakMap`, `Symbol` |
| signals and `computed` values | instances of package classes and of classes that are not data classes, unless built with [`reconstruct`](../learn/resuming.md#library-objects-reconstruct) or rebuilt by the class (`static [revive]`, `registerClass`) |
| instances of data classes: a class declared in a component module, with plain fields only (no `#private` field, no base class other than a data class of the same module, no `window` / `document` read while constructed); the browser restores the fields without running the constructor | |
| functions written in a resume-compiled module: local constants, inline props (`onChange={(v) => …}`), values in objects (`{ onKeyDown: (e) => … }`), returned functions, destructuring defaults (`{ format = (n) => … }`), functions written inline or stored by name into a value a handler uses (`api.inc = () => …`, `api.open = open`, `list.push(open)`, `signal(() => …)`, `[() => …]`), module-level or imported functions (also npm exports) used by name inside a component — passed as a prop (`format={formatEuro}`), kept in a local constant (`const format = formatEuro;`) or stored in an object / array / call argument (`{ format: formatEuro }`) — also when they reach a handler through props | |

Such functions are rebuilt in the browser from their own code and captures, so they work, even after passing through props, objects or hooks. A function Rivet did not compile this way does not. See [function is not serializable](../gotchas/function-is-not-serializable.md) for the full list.

When a capture breaks the rule, you see an error at build or render time, for example "Resumable code cannot capture `api`: class instances are not serializable" or "Promise is not serializable". In development the message also names the capture and the path of the bad value, such as ``capture `props` .items[2].onClick`` on the dev server (`capture #0 .items[2].onClick` in a development build).

## Do

```tsx prefer
import { signal } from "@rivetjs/reactivity";

export function Price({ amount, currency }: { amount: number; currency: string }) {
  const quantity = signal(1);
  return (
    <button type="button" onClick={() => quantity.update((n) => n + 1)}>
      {/* Build the formatter where it is used, not as a capture. */}
      {new Intl.NumberFormat("en", { style: "currency", currency }).format(amount * quantity())}
    </button>
  );
}
```

The handler captures only `quantity`, a signal. The formatter is created inside the expression, from `currency`, a string.

## Don't

```tsx avoid
export function Price({ amount }: { amount: number }) {
  const format = new Intl.NumberFormat("en", { style: "currency", currency: "EUR" });
  // Captures `format` (a class instance): fails.
  return <button type="button" onClick={() => alert(format.format(amount))}>{format.format(amount)}</button>;
}
```

A callback prop (`onBuy`) works when its parent writes it in a resume-compiled module (`<Price onBuy={(n) => cart.add(n)} />`); one that comes from a module Rivet does not resume-compile fails.

## When to break it

You cannot: a capture that is not serializable cannot reach the browser. But you can move the value so it is not a capture:

- Import a module at the top of the file. Imports are not captures; the browser loads the module itself.
- Create the object inside the handler, when it runs.
- Put browser-only objects (an `EventSource`, a chart instance) inside a `clientEffect` and clean them up there.
