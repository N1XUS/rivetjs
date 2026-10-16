---
title: Motion API
description: Every export of @rivetjs/motion: Motion element props, MotionConfig, Presence, PresenceFor, layout, animate, scroll, in-view and reduced motion.
template: reference
status: experimental
related: [guides/motion/index, guides/motion/presence, guides/motion/layout, guides/motion/scroll]
---

`@rivetjs/motion` is split into entry points. Each one adds only its own code: a page that uses `/in-view` never loads the layout engine. Peer dependency: `motion` `>=14.1.0 <15`.

| Import | Exports |
| --- | --- |
| `@rivetjs/motion` | `Motion` (`Motion.div`, `Motion.button`, … 60 HTML + SVG tags), `MotionElement`, `MotionConfig`, `spring`, `stagger`, types |
| `@rivetjs/motion/presence` | `Presence`, `PresenceFor` |
| `@rivetjs/motion/layout` | `animateLayout`, `layoutDriver`, `LayoutGroup` |
| `@rivetjs/motion/animate` | `animate` (Motion's full engine), `spring`, `stagger` |
| `@rivetjs/motion/scroll` | `createScroll`, `scrollAnimation` |
| `@rivetjs/motion/in-view` | `createInView` |
| `@rivetjs/motion/reduced-motion` | `prefersReducedMotion` |
| `@rivetjs/motion/entrance.css` | stylesheet for entrances rendered without a head (custom-property form) |

## Motion element props

`<Motion.<tag>>` takes the tag's own props plus these. `<MotionElement as="div">` picks the tag by value (it brings every tag: prefer `Motion.<tag>`).

| Prop | Type | Notes |
| --- | --- | --- |
| `initial` | target, label(s) or `false` | Entrance start (CSS). Read once. |
| `animate` | target, label(s), signal or accessor | Live: every change animates. |
| `exit` | target or label(s) | Plays when the enclosing presence leaves. Read once. |
| `transition` | `Transition` | `duration`, `delay`, `ease`, `times`, `repeat`, `repeatType`, `type` (imported `spring`; the string `"spring"` throws), `bounce`, `visualDuration`, `stiffness`, `damping`, `mass`, `delayChildren`, `staggerChildren`, per-value overrides. |
| `variants` | `Record<string, target \| (custom) => target>` | Named targets. |
| `custom` | any | Passed to function variants. |
| `inherit` | `boolean` | `false`: do not follow the parent's labels. |
| `whileHover` / `whilePress` / `whileFocus` | target or label(s) | Gesture states (priority: press over hover over focus over `animate`). Which ones exist is read once. |
| `whileInView` | target or label(s) | With `viewport`: `once`, `root`, `margin`, `amount`, `ssr` (`"initial"` default, `"final"`). |
| `layout` | `true \| "position" \| "size"` | Animates inside `animateLayout`. Read once. |
| `layoutId` | `string` | Shared element id. Read once. Needs `@rivetjs/motion/layout` in the bundle (a named or a bare `import "@rivetjs/motion/layout"`). |
| `reducedMotion` | `"user" \| "always" \| "never"` | Default from `MotionConfig`, else `"user"`. Applies to entrances, live targets, gestures and layout. |
| `onAnimationStart` / `onAnimationComplete` | `(definition) => void` | |
| `onHoverStart` / `onHoverEnd` | `(event: PointerEvent) => void` | Mouse and pen only. |
| `onPressStart` / `onPressEnd` / `onPress` | `onPressEnd(event, { success })` | `onPress`: a successful press. |

`ref` composes with the element's own handle; `style` merges with the animated values.

## MotionConfig

`<MotionConfig transition reducedMotion>{children}</MotionConfig>`: defaults for every Motion element inside (`transition` merges under the element's own and under its gesture states; `reducedMotion` covers gestures and layout too).

## Presence

| Component | Props |
| --- | --- |
| `Presence` | `show` (value / signal / accessor), `initial` (`false`: no entrance on the first render), `unmount` (`false`: keep hidden content), `onExitComplete()`, `children: () => content` |
| `PresenceFor` | `each` (array / signal / accessor), `by(item, index)`, `initial`, `onExitComplete(key)`, `children(item, index)` |

## Layout

| Export | Signature |
| --- | --- |
| `animateLayout` | `(scope: Element \| Ref<Element> \| undefined, update: () => void, transition?) → Promise<{ finished, stop }>` |
| `layoutDriver` | `(transition?) → FlipDriver` for cdk `Masonry` `motion` (WAAPI; default `{ duration: 0.3 }`) |
| `LayoutGroup` | `{ id?, children }` |

## animate

`animate(target, keyframes, options?)` and `animate(sequence, options?)`: Motion's hybrid `animate` (about 18 KB). Targets: an element, a selector, a `ref()`, an accessor, or an array of them. Browser only: call it in an event handler or a `clientEffect`; on the server it reports an error in development and does nothing in production.

## Scroll, in-view, reduced motion

| Export | Signature |
| --- | --- |
| `createScroll` | `({ container?, target?, axis?, offset? }?) → { x(), y(), xProgress(), yProgress() }` (0 on the server) |
| `scrollAnimation` | `(target, keyframes, { container?, target?, axis?, offset?, transition? }?) → void` |
| `createInView` | `(target, { once?, margin?, amount?, root? }?) → () => boolean` (`false` on the server) |
| `prefersReducedMotion` | `() → () => boolean` (live; `false` on the server) |
