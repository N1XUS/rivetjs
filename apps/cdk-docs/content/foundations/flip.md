---
title: FLIP
description: "@rivetjs/cdk/flip animates layout changes: capture boxes, apply the change, play from the old box with the house spring or a driver such as Motion's."
template: guide
status: experimental
related: [components/masonry, foundations/motion]
---

`@rivetjs/cdk/flip` is the layout-animation core the [Masonry](../components/masonry.md) and Bento relayouts use: **F**irst (capture the boxes), **L**ast (the new boxes), **I**nvert (offset each element back), **P**lay (animate the offset away). The animation itself comes from a driver: the house [motion](./motion.md) spring by default, or any object with a `play` method, such as `layoutDriver` from `@rivetjs/motion/layout`. Apps that do not import it pay nothing.

## Import

```ts
import { captureBoxes, playFlip, stopFlip, motion1dDriver, flipAllowed, type FlipDriver } from "@rivetjs/cdk/flip";
```

## API

| Export | Signature | Notes |
| --- | --- | --- |
| `captureBoxes` | `(els, relativeTo, rtl?) → Map<Element, Box>` | One rect read per element; `Box` = `{ x, y, width, height }` from the container's start edge. |
| `animatingBoxes` | `(container, rtl?) → Map<Element, Box>` | Visual boxes of a running FLIP's elements (start a new one from where they are). |
| `playFlip` | `(container, items, { viewport?, rtl?, driver? }?) → stop` | `items`: `{ el, from, to, base?, final? }`; `base` = the element's own transform, `final()` = its inline styles at the end. |
| `stopFlip` | `(container) → void` | Stops the running FLIP; the core commits the final styles. |
| `motion1dDriver` | `({ duration = 25, friction = 0.68 }?) → FlipDriver` | House spring (embla units); the default driver. |
| `flipAllowed` | `(motion) → boolean` | `false` for `false`, on the server and under reduced motion. |
| `FlipDriver`, `FlipRun`, `FlipMove`, `FlipItem`, `Box` | types | See Drivers. |

## Animate a change

```ts
const els = [...grid.children] as HTMLElement[];
const before = captureBoxes(els, grid); // one rect read per element
applyTheChange(); // reorder, resize, …
const after = captureBoxes(els, grid);
if (flipAllowed(true)) playFlip(grid, els.map((el) => ({ el, from: before.get(el)!, to: after.get(el)! })));
```

- Boxes are relative to the container, from its start edge (pass `rtl` for right-to-left).
- `to` can come from your own geometry instead of a measure: masonry computes it, so its relayout reads one rect.
- Items that did not move (under 0.5 px) are skipped, and so are items outside `viewport` before and after.
- A new `playFlip` on the same container stops the running one first, starting from where the elements are; `stopFlip(container)` stops it.
- `flipAllowed(motion)` is `false` for `motion === false`, on the server and under `prefers-reduced-motion: reduce`.

## Drivers

```ts
interface FlipDriver {
  play(run: { items: FlipMove[]; render(t: number): void; done(): void }): () => void;
}
```

- A progress driver calls `render(t)` with 0 → 1 and then `done()`; the core writes the transforms and sizes. `motion1dDriver({ duration, friction })` is the house spring (embla's `Motion1D`), the default.
- A per-element driver reads `items` (each with its inverted offset `dx` / `dy`, `base` transform and `resize` flag) and animates them itself. `layoutDriver(transition)` from `@rivetjs/motion/layout` does this with WAAPI (compositor transforms), with Motion's tweens or springs:

```tsx
import { spring } from "@rivetjs/motion";
import { layoutDriver } from "@rivetjs/motion/layout";

<Masonry items={items} columns={4} motion={layoutDriver({ type: spring, visualDuration: 0.35, bounce: 0.2 })}>
  {(item) => <Card item={item} />}
</Masonry>;
```

## Notes

- Drivers are browser-only objects: they are created when a relayout plays, never sent with the page.
- On 1000 masonry items (4× CPU slowdown) the house driver and `layoutDriver` reached the first frame in about 36 ms with one rect read; Motion's own layout engine read every box and took 112 ms.
