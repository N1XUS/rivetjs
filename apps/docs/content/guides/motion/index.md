---
title: Motion
description: Animate elements with @rivetjs/motion, the Motion (motion.dev) API on Rivet signals: entrances in CSS, live targets, gestures and reduced motion.
template: guide
status: experimental
related: [guides/motion/presence, guides/motion/layout, guides/motion/scroll, reference/motion]
---

`@rivetjs/motion` brings the [Motion](https://motion.dev) API to Rivet: `<Motion.div animate={…}>`, variants, gestures, exit animations, layout animations and scroll values. It runs on Motion's small WAAPI engine (`motion/mini`), and the server lowers entrances to CSS, so a page with animations still loads no JavaScript until something needs it. After reading this page you can install it, animate elements, react to hover, press and focus, and know what runs on the server and in the browser.

::example{id=motion-basics}

:::note
This package is experimental. It needs `motion` 14.x as a peer dependency, never React.
:::

## Install

```sh
npm install @rivetjs/motion motion
```

`motion` is a peer dependency (`>=14.1.0 <15`): you install it once and every Rivet package uses the same copy.

## Animate an element

`Motion` has one component per HTML and SVG tag. Give it a target:

```tsx
import { Motion } from "@rivetjs/motion";

export default function Hero() {
  return (
    <Motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      Hello
    </Motion.h1>
  );
}
```

- `initial`: where the entrance starts. Leave it out (or pass `false`) and the element renders `animate` directly.
- `animate`: the target. Values, keyframe arrays (`{ x: [0, 20, 0] }`) or a variant label.
- `transition`: `duration` and `delay` in seconds, `ease`, `repeat`, per-value overrides (`{ opacity: { duration: 0.2 } }`).

Values use Motion's names: `x`, `y`, `z`, `scale`, `scaleX`, `scaleY`, `rotate`, `opacity`, colors, `filter`, `clipPath`, `borderRadius`, sizes and any other CSS property the browser can animate. Numbers get Motion's units (`px`, `deg` for rotations). `x` / `y` / `scale` / `rotate` become the CSS `translate`, `scale` and `rotate` properties, which run on the compositor.

Values that need Motion's full engine (`rotateX`, `skew`, SVG `pathLength`, different transitions for `x` and `y`) give a clear error in development. Use `animate` from `@rivetjs/motion/animate` for them, in an event handler or a `clientEffect` (see [the reference](../../reference/motion.md)).

## Entrances are CSS

The server writes the **final** state inline (`style="opacity:1;translate:0px 0px"`), so the content is visible and counts for LCP without JavaScript. The entrance becomes one CSS `@keyframes` rule per distinct entrance, in the page head with the request's CSP nonce. Nothing runs in the browser for it.

When the head is already sent (a part streamed after the shell, a plain `renderToString`), the element carries the entrance as inline custom properties instead. Import the static sheet once so those play too:

```ts
import "@rivetjs/motion/entrance.css";
```

## Live targets

Pass a signal or an accessor and the element animates every time it changes:

```tsx
const open = signal(false);

<Motion.div animate={() => (open() ? { height: 240, opacity: 1 } : { height: 0, opacity: 0 })} transition={{ duration: 0.25 }} />;
```

On a resumed page the target is a binding: the animation code loads when the value first changes, not at load.

## Springs

Import Motion's spring and pass it as the type: `transition={{ type: spring, visualDuration: 0.4, bounce: 0.25 }}` (`import { spring } from "@rivetjs/motion"`). Entrances, live targets and gestures all take it. For entrances it becomes a CSS `linear()` easing. It adds about 1.8 KB, only where you use it. The string `type: "spring"` throws an error that names the import.

## Variants and stagger

Name targets once and let children follow the parent's label:

```tsx
import { Motion, stagger } from "@rivetjs/motion";

const list = { hidden: {}, show: { transition: { delayChildren: stagger(0.05) } } };
const item = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } };

<Motion.ul variants={list} initial="hidden" animate="show">
  <For each={items} by={(it) => it.id}>
    {(it) => <Motion.li variants={item}>{it().name}</Motion.li>}
  </For>
</Motion.ul>;
```

A child without its own `animate` follows the parent's labels (`inherit={false}` opts out). Function variants receive `custom`. Staggered entrances stay CSS: one rule with a per-child delay.

## Gestures

::example{id=motion-gestures}

- `whileHover`: while a mouse or pen is over the element (touch is ignored).
- `whilePress`: while the primary button is down, or Enter / Space is held on the element (make it focusable). `onPress` fires on a successful press; `onPressStart` / `onPressEnd(event, { success })` too.
- `whileFocus`: while the element shows a focus ring (`:focus-visible`).
- `whileInView` + `viewport` (`once`, `margin`, `amount`, `root`): while the element is in the viewport.

When a gesture ends the element returns to the next active state (press, then hover, then `animate`). An element without gestures binds no handler, so hovering it loads nothing.

## Server, resume and the browser

| Element | Server | Resumed page | Client render |
| --- | --- | --- | --- |
| `animate` only | final styles inline | nothing runs | styles set |
| `initial` → `animate` | final styles + one CSS rule | CSS plays the entrance, no JS | same rule |
| live `animate={signal}` | current target inline | code loads on the first change | binding |
| `whileHover` / `whilePress` / `whileFocus` | nothing extra | handlers resume; the hover code is preloaded when the element is visible | handlers |
| `whileInView` | the `initial` state | an observer attaches when the element nears the viewport | same |
| `exit` | nothing | plays when its [presence](./presence.md) leaves | same |

"Nothing runs" holds for a page that does not resume at all (a static page ships no script). When the component around a `Motion` element resumes for another reason (a signal, a handler), the element's code is part of that component's code and loads with it, even for a CSS-only entrance: about 33 KB raw measured for one `<Motion.h1 initial animate>` on an otherwise small page. Keep CSS-only entrances out of interactive components when bytes before the first input matter.

:::gotcha
`whileInView` elements render their `initial` state on the server, so they stay hidden without JavaScript. Pass `viewport={{ ssr: "final" }}` to render the in-view state instead (nothing animates on view then).
:::

## Reduced motion

By default (`reducedMotion="user"`), when the user asks the system for reduced motion, transform and layout animations jump to their end while opacity and colors still animate. This also applies to CSS entrances (a `prefers-reduced-motion` block in the same rule). `"always"` applies it for everyone, `"never"` turns it off. Set it per element (`reducedMotion`) or for a subtree:

```tsx
import { MotionConfig } from "@rivetjs/motion";

<MotionConfig reducedMotion="user" transition={{ duration: 0.2 }}>
  {/* every Motion element inside */}
</MotionConfig>;
```

The policy covers every animation of the element: entrances, live targets, gestures (hover, press, focus, in view) and layout. `MotionConfig transition` is the default under each element's own `transition` and under its gesture states. `reducedMotion="always"` makes a hover `scale` jump while its opacity still animates.

## Motion and the cdk

The cdk's own physics (carousel, drawer, sliders, drag and drop, masonry) stay on the house `Motion1D` springs: gestures and drag feel the same everywhere. `@rivetjs/motion` is for declarative and keyframe animations, exits, layout, scroll and in-view. There is no `drag` prop.

## Coming from motion/react

| motion/react | Rivet |
| --- | --- |
| `<motion.div>` | `<Motion.div>` (`MotionElement as="div"` for a dynamic tag) |
| `whileTap`, `onTap` | `whilePress`, `onPress` |
| `whileHover`, `whileFocus`, `whileInView` + `viewport`, `variants`, `custom`, `stagger` | same names |
| `transition={{ type: "spring" }}` | `transition={{ type: spring }}` with `import { spring } from "@rivetjs/motion"` |
| `<AnimatePresence>` | `<Presence show>` for one subtree, `<PresenceFor each by>` for a list; kit `Transition` and cdk overlays already are presences |
| `layout`, `layoutId`, `<LayoutGroup>` | same props; elements animate inside `animateLayout(update)`, not on every render |
| `<MotionConfig transition reducedMotion>` | same |
| `<LazyMotion>`, `m` | not needed: each subpath import brings its own code |
| `useScroll`, `useInView`, `useReducedMotion` | `createScroll`, `createInView`, `prefersReducedMotion` (accessors) |
| `useAnimate`, `animate` | `animate` from `@rivetjs/motion/animate` |
| `useMotionValue`, `useTransform` | signals and `computed` |
| `drag` | not supported: cdk drag and drop |

## Next

- [Presence](./presence.md): exit animations, keyed lists, cdk overlays.
- [Layout](./layout.md): animate size and position changes, shared elements.
- [Scroll](./scroll.md): scroll progress, scroll-linked animations, in-view.
