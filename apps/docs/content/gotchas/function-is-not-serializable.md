---
title: Function is not serializable
description: Why a page whose route data holds a function or a class instance renders but does not resume, and how to fix it.
template: gotcha
related: [best-practices/pass-data-not-services, learn/resuming, guides/routing/loading-data]
---

## What you see

The page renders, but nothing on it reacts until you navigate to another page, and the server prints a warning:

```txt
[RV2107] Route data cannot resume (derived model): function is not serializable. The page renders but does not resume. …
```

The reason names what was found: a function, a symbol, a promise, or an instance of a class that is not registered (`Price instance is not serializable`).

## Why

Handlers and component code are not sent: the browser runs a component's code again when it wakes up and builds its functions and objects there. What does travel is data: the signal values of interactive components, the plain-data props of components that wake up alone, and, with file routes, the route's loader data, which the page's root component gets as props.

Route data must be :term[serializable]{id=serializable}: strings, numbers, booleans, `null`, `undefined`, plain objects and arrays, `Date`, `Map`, `Set`, `URL`, `URLSearchParams`, `RegExp`, `bigint`, typed arrays, errors, shared references and cycles. A function, a promise, a symbol or an instance of an unregistered class has no such form, so the page is left as server HTML. See [RV2107](../errors/RV2107.md).

A function or a class instance passed as a **prop** between components is fine: the child then runs together with its parent, which builds the value again in the browser. See [what reaches the browser](../learn/resuming.md#what-reaches-the-browser).

## Fix

Return data from the loader and build functions and objects in the component that uses them:

```tsx title="src/routes/price.tsx"
import { load, type PageProps } from "@rivetjs/router";

export const loader = load(async () => ({ cents: 1999 })); // data, not a Price instance or a formatter

export default function Page({ data }: PageProps<typeof loader>) {
  const format = (cents: number) => (cents / 100).toFixed(2); // built where it is used
  return <p>{format(data.cents)} EUR</p>;
}
```

For an instance of your own class (or a package class such as bson's `ObjectId`), register it with `registerClass(Class, { id, serialize, revive })` from `@rivetjs/runtime/resume-format` in a module that both the server and the browser import. See [classes in route data](../learn/resuming.md#classes-in-route-data).

:::note
The dev server renders pages the same way as production, so `vite` dev prints this warning too. See [Dev and production differ](dev-and-production-differ.md) for what still differs.
:::
