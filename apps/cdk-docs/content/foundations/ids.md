---
title: Ids
description: Unique ids for label, aria-labelledby and aria-describedby with createId, withIdScope, useId, idSignal, mergeIds and useSlotId from @rivetjs/cdk/id.
template: guide
status: experimental
related: [foundations/overview, foundations/dom-props, components/text-field]
---

ARIA connects elements by id: a label `for` an input, a hint in `aria-describedby`, a panel in `aria-controls`. A reusable component cannot hard-code those ids, or two copies on one page collide. `createId()` from `@rivetjs/cdk/id` returns an id unique in the document, on the server and in the browser.

::example{id=ids-create-id}

```tsx title="src/components/Field.tsx"
import { createId } from "@rivetjs/cdk/id";

export function Field(props: { label: string; hint: string }) {
  const id = createId();
  return (
    <div>
      <label for={id}>{props.label}</label>
      <input id={id} aria-describedby={id + "-hint"} />
      <p id={id + "-hint"}>{props.hint}</p>
    </div>
  );
}
```

Call `createId()` once in the component body and derive the related ids from it, as above.

## How the ids look

| Where the component runs | Ids |
| --- | --- |
| On the server | `rv` and a counter per page render (`rv0`, `rv1`, …). The router counts every request from 0, so a page gets the same ids on every render (reproducible HTML). Ids created outside a render (module level, after an `await` in an async function) are `rvs` and a process-wide counter, so they never collide with a page's ids. |
| In the browser | `rvc` and a counter. Content created after the page resumed (behind a `Show`, after a navigation) can never collide with an id from the server HTML. |
| Inside `withIdScope(prefix, fn)` | `prefix` and a counter from 0, the same on every render. |

The resumed page keeps the server's ids: components do not run again in the browser, so nothing is regenerated. There is no hydration, so no server and client ids have to match.

## API

| Export | Does |
| --- | --- |
| `createId()` | A new document-unique id. |
| `withIdScope(prefix, fn)` | Runs `fn` with its own counter from 0; nested scopes use the inner prefix, then the outer one continues. For byte-stable HTML (tests, cached fragments) or several render roots on one page. |
| `useId(defaultId?)` | `defaultId` when given, else `createId()` (React Aria `useId`). |
| `idSignal(defaultId?)` | A reactive id (`Signal<string>`) that `mergeIds` can change. Browser-side bookkeeping, dropped when the signal is collected or by `releaseId`. |
| `mergeIds(idA, idB)` | Equal → that id. Otherwise the reactive ids holding `idA` switch to `idB` (returns `idB`), else those holding `idB` switch to `idA` (returns `idA`), else `idB`. |
| `releaseId(id)` | Forget the reactive ids registered for `id`. |
| `useSlotId(id, root?)` | `id` when an element with that id is in `root`'s document, else `undefined`, so `aria-describedby` never points at a missing element. Call it in a handler or client effect; on the server it returns `id`. |

`createId` and `withIdScope` are re-exports of `@rivetjs/runtime/id`.

## withIdScope and useId

::example{id=ids-scope}

## idSignal, mergeIds and useSlotId

::example{id=ids-merge}

## Common mistakes

- **Ids that must be the same on every request.** The server counter is shared by the process, so ids change between requests. Pass an explicit `id`, or render inside `withIdScope`.
- **Calling `createId()` in JSX.** `<label for={createId()}>` and `<input id={createId()}>` get two different ids. Call it once in the component body.
- **Random ids.** `Math.random()` ids differ between the server and anything rendered later, and tests cannot rely on them.
- **`useSlotId` while rendering.** The slot may not be in the document yet; on the server it always returns the id.

## Upstream

`useId`, `mergeIds` and `useSlotId` are ports of `@react-aria/utils` `useId.ts`. Deviations: `useId` needs no SSR matching (no hydration); React re-renders components whose id lost a `mergeIds`, Rivet updates `idSignal` signals instead; `useSlotId` is a plain check, not a layout effect.
