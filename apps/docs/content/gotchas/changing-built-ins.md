---
title: Changing built-ins
description: Rivet assumes JavaScript built-ins like Array.prototype.map and Object.prototype behave as standard. Changing them is not supported.
template: gotcha
related: [learn/server-first, guides/security/server-only-code]
---

## What you see

There is no error message for this one. After a library or your own code changes a JavaScript built-in, pages render wrong output, hang, or fail in ways that are hard to trace. For example:

- a `then` method added to `Object.prototype` makes every object look like a Promise to the server renderer, so it may wait for values that never arrive,
- a patched `Array.prototype.map` changes how lists in JSX render,
- a replaced `Object.freeze`, `WeakMap` or `WeakSet` method breaks Rivet's internal bookkeeping.

## Why

Rivet requires untampered JavaScript built-ins after startup, the same rule React and Solid follow. "Built-ins" are the objects JavaScript itself provides: `Object`, `Array`, `Promise`, `Map`, `WeakMap`, their prototypes and methods.

The server renderer relies on these behaving as the language standard says. Checking them on every render would make rendering slower: Rivet measured guards like that and found they cost about 20% of the rendering CPU time per list row. So Rivet does not check. It trusts the built-ins instead.

## Fix

- Do not add properties to `Object.prototype`, `Array.prototype` or other built-in prototypes.
- Do not replace built-in methods after your app has started.
- Avoid libraries that do either. Look for words like "extends native prototypes" or "monkey-patches" in their docs.
- If you need a polyfill, load it before any Rivet module, and make sure it follows the standard.

If something renders wrong and you cannot find the cause, check whether code you import changes a built-in. In Node you can compare, for example, `Object.prototype.then === undefined` and `Array.prototype.map.toString()` (it should contain `[native code]`) at startup and inside a request.
