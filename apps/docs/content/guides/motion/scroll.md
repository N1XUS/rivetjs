---
title: Scroll and in-view
description: Read scroll position and progress as signals with createScroll, link animations to scroll, and react when elements enter the viewport.
template: guide
status: experimental
related: [guides/motion/index, reference/motion]
---

Scroll effects need two things: how far the page (or a box) has scrolled, and whether an element is visible. `@rivetjs/motion` gives both as accessors, and a scroll-linked animation that runs on the browser's own scroll timeline. After reading this page you can build a progress bar, animate with scroll and react to visibility.

::example{id=motion-scroll}

## createScroll

```tsx
import { createScroll } from "@rivetjs/motion/scroll";

const scroll = createScroll(); // the window
<div class="progress" style={{ transform: `scaleX(${scroll.yProgress()})` }} />;
```

- Returns `{ x, y, xProgress, yProgress }`: positions in px and progress from 0 to 1.
- Options: `container` (a `ref()` to a scroll box), `target` + `offset` (progress of one element through the container, Motion's offsets like `["start end", "end start"]`), `axis`.
- On the server every value is 0. In the browser the listener attaches when the page is idle (window) or when the target nears the viewport.

## scrollAnimation

For an animation that follows scroll, let the browser run it:

```tsx
import { scrollAnimation } from "@rivetjs/motion/scroll";

const bar = ref<HTMLElement>();
clientEffect(() => scrollAnimation(bar, { scale: [0, 1] }, { container: box }));
```

It uses a native `ScrollTimeline` where the browser has one, so the animation runs off the main thread.

## createInView

```tsx
import { createInView } from "@rivetjs/motion/in-view";

const box = ref<HTMLElement>();
const seen = createInView(box, { once: true, amount: 0.5 });
<section ref={box} class={seen() ? "visible" : "hidden"}>…</section>;
```

- Options: `once` (stay true after the first entry), `amount` (`"some"`, `"all"` or 0–1), `margin` (root margin), `root`.
- `false` on the server. For an element's own animation, `whileInView` on a Motion element does the same with less code.

## Reduced motion

`prefersReducedMotion()` from `@rivetjs/motion/reduced-motion` returns an accessor that follows the system setting live (`false` on the server):

```tsx
import { prefersReducedMotion } from "@rivetjs/motion/reduced-motion";

const reduced = prefersReducedMotion();
<video autoplay={!reduced()} />;
```
