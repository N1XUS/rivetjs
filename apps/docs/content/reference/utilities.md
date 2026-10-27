---
title: Utility APIs
description: Generate element ids, restore an owner for a callback, select Set members, load functions lazily, and decode form data.
template: reference
related: [guides/components/context, guides/state/signals, guides/components/forms-and-input, guides/forms/forms, guides/performance/chunks]
---

These utilities are public exports for application code. Import each from the entry shown below.

## Element ids: createId

Use `createId` from `@rivetjs/runtime/id` when a reusable component needs an id for a label or ARIA relation:

```tsx check
import { createId } from "@rivetjs/runtime/id";

export function EmailField() {
  const id = createId();
  return (
    <div>
      <label for={id}>Email</label>
      <input id={id} name="email" type="email" />
    </div>
  );
}
```

The router gives each server render its own id scope. Unscoped server ids and newly created browser ids use separate prefixes.

### Explicit scopes: withIdScope

For a custom synchronous render or a test, `withIdScope(prefix, fn)` starts a counter at zero for `fn`:

```ts check
import { createId, withIdScope } from "@rivetjs/runtime/id";

const ids = withIdScope("profile-", () => [createId(), createId()]);
// ["profile-0", "profile-1"]
```

Choose distinct prefixes for roots that share a document. The scope does not remain active across an `await`.

## Owner callbacks: runWithOwner

Capture an owner with `getOwner()` and use `runWithOwner(owner, fn)` to restore it for a synchronous callback. Context lookup and cleanup registration then belong to that owner:

```ts check
import { createContext, createRoot, getOwner, provide, runWithOwner, useContext } from "@rivetjs/reactivity";

const Theme = createContext("light");

createRoot((dispose) => {
  const readTheme = provide(Theme, "dark", () => {
    const owner = getOwner();
    return () => runWithOwner(owner, () => useContext(Theme));
  });
  readTheme(); // "dark", even though the provide callback has returned
  dispose();
});
```

A disposed owner throws `Cannot run with a disposed owner`. Restoring an owner does not restore the caller's reactive subscription, and it does not carry context across an `await`. For async rendering work, see [context after await](../gotchas/context-gone-after-await.md).

## Set selectors: memberKeys

Pass `memberKeys` as a `selector` key hint for a `Set` source. It returns the keys added or removed between two sets, so only those subscribed keys need comparison:

```ts check
import { memberKeys, selector, signal } from "@rivetjs/reactivity";

const selected = signal(new Set<string>());
const isSelected = selector(selected, (key: string, values) => values.has(key), {
  keys: memberKeys,
});
selected.set(new Set(["book-1"]));
isSelected("book-1"); // true
isSelected("book-2"); // false
```

If either argument is not a `Set`, `memberKeys` returns `null`, meaning all subscribed keys must be checked. A `Set` signal is initialized again in the browser; see [values in a resumed page](../guides/state/signals.md#values-in-a-resumed-page).

## Lazy functions: lazyFunction

`lazyFunction` from `@rivetjs/runtime/lazy` shares module loading between calls while invoking the selected function separately for each call. Select a named export with the second argument; omit it for a default export.

This complete example loads Rivet's text escaping helper dynamically. Use the same pattern with your own module:

```ts check
import { lazyFunction } from "@rivetjs/runtime/lazy";

const escape = lazyFunction(
  () => import("@rivetjs/runtime/escape"),
  (module) => module.escapeText,
);

escape.peek(); // undefined; does not start loading
await escape.load(); // load without invoking
await escape("Tea & toast"); // "Tea &amp; toast"
```

| Member | Behavior |
| --- | --- |
| `fn(...args)` | Load and invoke; always returns a promise |
| `fn.load({ signal }?)` | Return the selected function, sharing an in-flight or successful load |
| `fn.invoke(args, { signal }?)` | Invoke once with an argument tuple and optional cancellation |
| `fn.peek()` | Return the selected function if loaded, otherwise `undefined` |

A failed import or selection is retried on the next load. Invocation results are never cached. Aborting cancels one caller's wait; it cannot cancel a shared import or undo application work already started.

`escapeText` escapes `&`, `<` and `>` for HTML text. Normal JSX already escapes text; use this helper only when constructing text for a custom HTML writer. For a quoted attribute value, `escapeAttribute` from the same entry also escapes both quote characters:

```ts check
import { escapeAttribute } from "@rivetjs/runtime/escape";

escapeAttribute('Say "hello"'); // "Say &quot;hello&quot;"
```

Neither helper validates a URL or sanitizes a whole HTML document.

## Form input: decodeFormData

`decodeFormData` from `@rivetjs/forms` converts `FormData`, or an iterable of name/value pairs, into a nested object. Validation remains a separate step:

```ts check
import { decodeFormData } from "@rivetjs/forms";

const body = new FormData();
body.set("profile.name", "Ada");
body.set("quantity", "2");
body.append("tags[]", "books");
body.append("tags[]", "gifts");

const input = decodeFormData(body, {
  coerce: { quantity: "number", subscribed: "boolean" },
});
// { profile: { name: "Ada" }, quantity: 2, tags: ["books", "gifts"], subscribed: false }
```

- Unlisted fields stay strings. Empty strings are omitted by default; `emptyAs: "string"` keeps them.
- `coerce` accepts `"string"`, `"number"`, `"boolean"`, `"array"`, `"file"`, `"date"` and `"json"`. A `$` segment matches an array index, such as `"items.$.quantity"`.
- Repeated scalar names keep the last value. Use `[]` or `"array"` coercion to collect several values.
- Invalid number, date and JSON strings stay strings so a schema can report the error. Missing boolean and array fields default to `false` and `[]` when configured in `coerce`.
- Limits default to 1,000 fields, 256 characters per field name, eight path segments and a maximum array index of 1,000. Override individual values with `limits`.
- Malformed names or exceeded limits throw `FormDecodeError`, also exported from `@rivetjs/forms`.

For schema validation, submission and field feedback, use the [forms guide](../guides/forms/forms.md).
