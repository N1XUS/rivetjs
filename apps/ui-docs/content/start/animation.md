---
title: Animation
description: "Animate @rivetjs/ui components with the built-in CSS transitions, motion tokens, Tailwind utilities, render props, kit <Transition> and @rivetjs/motion."
template: guide
status: experimental
related: [start/styling, start/theming]
---

Rivet UI animates with CSS by default: components ship their own transitions and expose their state as attributes you can target. For enter and leave sequences there is `<Transition>` from `@rivetjs/kit`, and for springs, gestures, layout and exit animations `@rivetjs/motion`. Pick the lightest tool that does the job; the CSS options need no JavaScript at all.

## State attributes

Components describe their current state with attributes, and their stylesheets animate on those. The same attributes are available to your CSS:

| Attribute                                          | Set while                          |
| -------------------------------------------------- | ---------------------------------- |
| `[data-hovered="true"]`                            | the pointer is over the element    |
| `[data-pressed="true"]`                            | the element is being pressed       |
| `[data-focus-visible="true"]`                      | it has keyboard focus              |
| `[data-disabled="true"]`                           | it is disabled                     |
| `[data-entering]` / `[data-exiting]`               | an overlay is opening / closing    |
| `[data-expanded="true"]`, `[aria-expanded="true"]` | a panel or its trigger is expanded |

A few of the built-in rules, simplified:

```css
/* Popover opens with a fade + zoom, closes with the reverse */
.popover[data-entering="true"] {
  @apply animate-in duration-(--duration-fast) ease-smooth fade-in-0 zoom-in-90;
}

.popover[data-exiting="true"] {
  @apply animate-out duration-(--duration-fast) ease-smooth zoom-out-95 fade-out;
}

/* Button shrinks slightly while pressed */
.button:active,
.button[data-pressed="true"] {
  transform: scale(0.97);
}

/* Accordion panel grows to its measured height */
.accordion__panel {
  height: var(--disclosure-panel-height);
  transition:
    height var(--duration-base) var(--ease-out-quad),
    opacity var(--duration-base) var(--ease-out);
}
```

## Motion Tokens

All component transitions draw on three durations and one easing curve defined in the theme. Change them once and the whole app follows:

| Token             | Value                        | Used for                                                |
| ----------------- | ---------------------------- | ------------------------------------------------------- |
| `--duration-fast` | 120 ms                       | colour, opacity, small moves (hover, press, indicators) |
| `--duration-base` | 180 ms                       | transforms, popovers, panels                            |
| `--duration-slow` | 260 ms                       | large surfaces (drawers, sidebars, calendars)           |
| `--ease-smooth`   | `cubic-bezier(0.2, 0, 0, 1)` | the default curve: fast start, soft stop                |

Full-screen overlays (Modal, AlertDialog, Drawer, Sheet, Command, Lightbox, the Sidebar's mobile sheet and the Navbar's mobile menu) share a separate timing based on the iOS sheet curve, so they all open and close the same way (the Sidebar's mobile sheet slides exactly like a Drawer on the same side):

| Token                     | Value                            | Used for                                    |
| ------------------------- | -------------------------------- | ------------------------------------------- |
| `--overlay-duration`      | 500 ms                           | panel enter (slide, or Modal's fade + zoom) |
| `--overlay-fade-duration` | 400 ms                           | backdrop fade-in, nested Sheet step-back    |
| `--overlay-exit-duration` | `var(--duration-slow)` (260 ms)  | panel and backdrop exit                     |
| `--overlay-ease`          | `cubic-bezier(0.32, 0.72, 0, 1)` | enter and exit curve                        |

The picker chevrons (Select, ComboBox, Autocomplete, CellSelect, NativeSelect) and the Navbar menu toggle morph between shapes on their own tokens (CSS only, no JavaScript; reduced motion swaps them at once):

| Token | Value | Used for |
| --- | --- | --- |
| `--duration-morph-chevron` | 320 ms | chevron down, flat line, chevron up (`--<component>-indicator-duration` per component) |
| `--ease-morph-chevron-open` / `--ease-morph-chevron-close` | `linear(…)` | opening / closing curve (apple.com's navigation chevron) |
| `--duration-morph-burger` | 240 ms | menu toggle, three bars to an X (`--navbar-toggle-duration`) |
| `--ease-morph-burger` | `linear(…)` | both directions |

Override a token in your theme, or reuse it in your own rules:

```css
:root {
  --duration-base: 220ms;
}

.my-panel {
  transition: transform var(--duration-base) var(--ease-smooth);
}
```

Some details are fixed rather than tokenised:

- Pill controls (Button, ToggleButton) scale to 0.97 while pressed, at every size.
- Loading spinners take the icon size of their control: 16 px in a Button, 20 px in a large one.
- Sheet drag and snap physics and looping indicators (spinners, shimmer) keep their own timings.

## CSS animations

Tailwind animation utilities work on any component through `class`:

```tsx
// Pulse on hover
<Button class="hover:animate-pulse">Hover me</Button>

// Fade in entrance
<Alert class="animate-fade-in">Welcome message</Alert>

// Staggered list
<div class="space-y-2">
  <Card class="animate-fade-in animate-delay-100">Item 1</Card>
  <Card class="animate-fade-in animate-delay-200">Item 2</Card>
</div>
```

To change a built-in transition everywhere, override the component class in your stylesheet:

```css
/* Slower accordion: the panel (interactive path) and the <details> content slot (zero-JS native path).
   Two rules: a browser without ::details-content drops a whole selector list that names it. */
.accordion__panel {
  transition-duration: 500ms;
}
details.accordion__item::details-content {
  transition-duration: 500ms;
}

/* Bouncy button */
.button:active {
  animation: bounce 0.3s;
}

@keyframes bounce {
  50% {
    transform: scale(0.95);
  }
}
```

Hover and press scaling is plain CSS as well:

```tsx
<Button class="transition-transform hover:scale-105 active:scale-95">Animated Button</Button>
```

## Enter and leave transitions

`<Transition>` from `@rivetjs/kit/transition` mounts and unmounts its child with class-based phases (Headless UI-style `enter` / `enterFrom` / `enterTo` / `leave` / … props, plus `data-*` phase attributes). It resumes without JavaScript until `show` changes:

```tsx
import { Transition } from "@rivetjs/kit/transition";

<Transition
  show={open}
  appear
  enter="transition duration-500"
  enterFrom="opacity-0 translate-y-5"
  enterTo="opacity-100 translate-y-0"
  leave="transition duration-200"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
>
  <Alert>
    <Alert.Title>Welcome!</Alert.Title>
  </Alert>
</Transition>;
```

## Rivet Motion

`@rivetjs/motion` brings Motion (motion.dev) to Rivet signals. It covers what CSS alone cannot: springs (`<Motion.button whilePress={{ scale: 0.92 }}>`), `exit` animations, shared layout (`layout`, `layoutId`, `animateLayout` from `@rivetjs/motion/layout`) and scroll / in-view values. Entrances render as CSS on the server, so a page stays free of JavaScript until something actually moves. Install `@rivetjs/motion` together with its peer `motion`; the full guide is on the main docs site ([Motion](site:docs/guides/motion/)).

How it fits with Rivet UI:

- A Motion element accepts the component classes like any element (`class={buttonVariants()}`).
- Modal, Drawer and Popover act as presences: a Motion element with `exit` inside one plays its exit when the overlay closes, and the overlay waits for it.
- Masonry and Bento take `motion={layoutDriver(transition)}` to run their relayout on Motion's WAAPI engine instead of the default house spring.

::example{id=motion-button-press}

::example{id=motion-modal-presence}

::example{id=motion-drawer-presence}

::example{id=motion-masonry-expand}

::example{id=motion-toast-stack}

Without Motion, a sliding indicator is a single element moved with a CSS transform:

```tsx
import { signal } from "@rivetjs/reactivity";

function Tabs(props: { items: string[] }) {
  const selected = signal(0);
  return (
    <div class="relative flex gap-2">
      <span class="absolute inset-y-0 left-0 w-24 rounded-full bg-accent transition-transform" style={{ transform: `translateX(${selected() * 104}px)` }} />
      {props.items.map((item, i) => (
        <Button class="relative w-24" variant="ghost" onPress={() => selected.set(i)}>
          {item}
        </Button>
      ))}
    </div>
  );
}
```

## Render props

Render props expose component state as accessors, so an animation can follow it directly. Only the bound style updates when the state changes:

```tsx
<Button>
  {({ isPressed, isHovered }) => (
    <span class="transition-transform" style={{ transform: `scale(${isPressed() ? 0.95 : isHovered() ? 1.05 : 1})` }}>
      Interactive Button
    </span>
  )}
</Button>
```

## Reduced motion

Built-in transitions and animations switch off for users who ask for less motion. Two signals count:

- the OS setting, through the `prefers-reduced-motion: reduce` media query;
- a `data-reduce-motion="true"` attribute on the element or any ancestor.

Both are folded into the `motion-reduce:` variant from `@rivetjs/ui/styles/variants`. The attribute wins; the media query applies when no attribute is set. Component styles use the variant like this:

```css
.button {
  @apply transition-colors motion-reduce:transition-none;
}

/* which matches in both cases: */
@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
}

[data-reduce-motion="true"] .button {
  transition: none;
}
```

Use the same variant in your own classes, including the class props of `<Transition>`:

```tsx
<Transition show={open} appear enter="transition duration-500 motion-reduce:transition-none" enterFrom="opacity-0" enterTo="opacity-100">
  <Card>Content</Card>
</Transition>
```

To turn animations off for the whole app regardless of the OS setting, set the attribute on `<html>` or `<body>`:

```html
<html data-reduce-motion="true">
  <!-- Rivet UI transitions and animations are disabled below this element -->
</html>
```

## Performance

Animate `transform` and `opacity`. The compositor handles them without layout or paint work; properties like `left`, `top`, `width` or `height` force a layout on every frame:

```css
/* Composited */
.slide-in {
  transform: translateX(-100%);
  transition: transform 0.3s;
}

/* Triggers layout every frame */
.slide-in {
  left: -100%;
  transition: left 0.3s;
}
```

`will-change` promotes an element ahead of an animation. It costs memory while set, so limit it to the time the element can actually animate:

```css
.button {
  will-change: transform;
}

.button:not(:hover) {
  will-change: auto;
}
```

## See also

- [Styling](/start/styling/)
- [Theming](/start/theming/)
- [Components](/components/overview/)
