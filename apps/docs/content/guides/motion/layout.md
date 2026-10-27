---
title: Layout animations
description: Animate position and size changes with layout and animateLayout, move shared elements with layoutId, and drive cdk masonry with Motion.
template: guide
status: experimental
related: [guides/motion/index, guides/motion/presence, reference/motion]
---

When a change moves elements (a list reorders, a card grows, an underline moves to another tab), a layout animation slides them from their old box to the new one. After reading this page you can animate reflows, connect two elements with a shared id and choose the animation engine for cdk masonry.

::example{id=motion-layout}

## animateLayout

Mark the elements with `layout` and make the change inside `animateLayout`:

```tsx
import { ref, For } from "@rivetjs/runtime/dom";

import { Motion } from "@rivetjs/motion";
import { animateLayout } from "@rivetjs/motion/layout";

const grid = ref<HTMLElement>();

<div ref={grid}>
  <For each={order} by={(n) => n}>
    {(n) => <Motion.div layout>{n()}</Motion.div>}
  </For>
</div>;

<button onClick={() => animateLayout(grid, () => order.update((list) => [...list].reverse()))}>Reverse</button>;
```

- `animateLayout(scope, update, transition?)` is Motion's vanilla signature: it records the boxes of the `[data-layout]` elements in `scope` (default: the whole page), runs `update` in one batch, reads the new boxes once and animates each element from the old box.
- `layout="position"` or `layout="size"` limits the animation to one of the two.
- It resolves to `{ finished, stop }`. Under reduced motion it only applies the update.
- An element's reduced-motion policy (its `reducedMotion` or MotionConfig's) is read once, when the element is created: a later MotionConfig change reaches gestures, `animate` and exits, not layout (a live policy would add a binding to every layout element's resume state).
- Use keyed lists (`For` with `by`): an element can only move if it is the same element before and after.
- Resumed pages: the first interaction can apply `update` later (the region it re-creates loads its chunks first). `animateLayout` then measures once that re-creation ran; an element the re-created region rendered again animates from the server element with the same `id`.

:::note
Elements animate inside `animateLayout`, not on every change: Rivet has no render cycle to compare. Without `@rivetjs/motion/layout` in your bundle, `layout` and `layoutId` only write an attribute and cost nothing. Importing any of its exports enables them, and so does a bare `import "@rivetjs/motion/layout";` when you only use `layoutId`.
:::

## Shared elements: layoutId

Two elements with the same `layoutId` are one element in two places: when the new one appears, it starts at the old one's box. The tab underline in the example:

```tsx
import { Motion } from "@rivetjs/motion";

import { LayoutGroup } from "@rivetjs/motion/layout";

<LayoutGroup id="tabs">
  {tabs.map((tab, i) => (
    <button onClick={() => animateLayout(undefined, () => selected.set(i))}>
      {tab}
      {selected() === i && <Motion.span layoutId="underline" />}
    </button>
  ))}
</LayoutGroup>;
```

`LayoutGroup` keeps ids of one widget apart from another (nested groups join their ids).

## cdk masonry and the house motion

cdk `Masonry` animates its own relayouts with the shared FLIP core `@rivetjs/cdk/flip` and the house `Motion1D` springs. Its `motion` prop also takes a driver, so you can hand the same animation to Motion's WAAPI engine:

```tsx
import { layoutDriver } from "@rivetjs/motion/layout";

<Masonry items={items} columns={4} motion={layoutDriver({ duration: 0.3 })}>
  {(item) => <Card item={item} />}
</Masonry>;
```

Both read the new positions from the masonry geometry (no measuring per item). On a 1000-item relayout at 4× CPU slowdown, both reached their first frame in about 36 ms; Motion's own layout engine read every box and took 112 ms and 24× the scripting, so `@rivetjs/motion` does not use it.
