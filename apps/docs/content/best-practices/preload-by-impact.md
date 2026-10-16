---
title: Preload by impact
description: Let Rivet's automatic preloading handle most code, and raise the priority only for the few interactions that matter most on a page.
template: best-practice
related: [guides/performance/preloading, guides/performance/chunks, guides/performance/measuring, learn/loading-code]
---

**Trust the automatic preload plan. Override it only for the one or two interactions users are most likely to use first, and measure before and after.**

## Why

Rivet sends no component code with the page. Each handler's code is a small chunk. The server plans when each chunk should be fetched (see :term[preload]{id=preload}):

- Click, submit and input handlers: when the user shows **intent** (the pointer rests on the element, or it gets focus).
- The same handler on three or more elements (list rows), and hover-like events: when the elements become **visible**.
- `clientEvent` listeners on `window` or `document`: when the browser is **idle**.

The page also ranks chunks by **impact**: clicks and submits count most, then input and change events, and links and forms count extra. Smaller chunks go first when the impact is equal.

This plan fetches little before the user acts. Making many chunks `eager` or `idle` undoes it: the browser downloads code the user may never run, and that competes with images and data.

## Do

Raise the priority of the main action on a page, and nothing else:

```tsx prefer
// The "Add to cart" button is why the page exists: fetch its code when the browser is idle.
<button type="button" preload="idle" onClick={() => addToCart(product.id)}>
  Add to cart
</button>
```

For a whole component, export a module-level default:

```tsx title="src/components/Checkout.tsx" prefer
export const preload = "visible";
```

For rules across the app, use the Vite option:

```ts title="vite.config.ts" prefer
rivetRouter({
  resume: { preload: { rules: [{ match: "src/components/Checkout.tsx#", strategy: "visible" }] } },
});
```

The element's `preload` attribute wins over the module export, which wins over the rules, which win over the automatic plan.

## Don't

```ts title="vite.config.ts" avoid
// Every chunk, right after the first paint.
rivetRouter({ resume: { preload: { rules: [{ match: /./, strategy: "eager" }] } } });
```

This turns a page that loads code on demand into one that loads all of it up front.

## When to break it

- **Measured slow first interactions.** If the [measuring guide](/guides/performance/measuring.md) shows that a common first click waits for its chunk, raise that chunk to `idle` or `visible`.
- **Rarely used, heavy code.** Use `interaction` for a chunk that should never be fetched on intent, only when the user actually clicks (a big editor behind a button).
- **Slow networks.** You do not need to handle them: with Save-Data or a 2G connection, Rivet turns off scheduled prefetching and fetches on intent only.
