---
title: What ships no JavaScript
description: See which pages and components a Rivet build turns into plain HTML and CSS, and how to keep a call site on that path.
template: guide
status: experimental
related: [guides/performance/chunks, guides/performance/preloading, guides/performance/measuring, learn/resuming]
---

A production build looks at every call site of a component and proves what it can about it: does it react to events, does it read a context, are its props constants. Where the proof says nothing in the browser needs Rivet, the build writes plain HTML and CSS instead, and the page loads less code or none at all.

After reading this page you know which cases ship no JavaScript, what keeps a call site eligible, and how to check a build.

All of this happens only in production builds. The dev server always runs the ordinary components; check a build (see [Measuring](measuring.md)).

## Static pages

A page with no interactive component (no handler, no signal read in markup, no client effect) gets no record and no list of files to fetch: the browser downloads no JavaScript file for it. Components that only render data are part of the HTML. Links on such a page are plain links; with file routes and client navigation, the router loads when the pointer rests on a link or on the first navigation ([Preloading](preloading.md)).

## Native controls

Some Rivet UI families have a native twin: a form of the same markup that the browser runs by itself, with every visual state written in CSS (`:checked`, `[open]`, `:hover`, `:active`, `:focus-visible`). Where the build proves a call site closed, the component renders the native form and ships no JavaScript, before or after an interaction:

| Component | Native form |
| --- | --- |
| [Switch](site:ui/components/switch/) | a visually hidden `<input type="checkbox" role="switch">` inside the `<label>` |
| [Checkbox](site:ui/components/checkbox/) | a visually hidden `<input type="checkbox">` |
| [Accordion](site:ui/components/accordion/) | one `<details>` per item; single expansion shares one `name` |
| [Table](site:ui/components/table/) | `table` / `thead` / `tbody` / `th scope` / `td`, no grid keyboard |
| [Button](site:ui/components/button/), [CloseButton](site:ui/components/close-button/) without `onPress` | a plain `<button>` |

A call site is closed when it passes only the props the family declares, as plain values (literals, constants), with no handler, spread, render prop, controlled state or live value, no component inside that reads a context or has its own behaviour, and no provider above that hands the component props or behaviour (a trigger, a group, a form with validation). The calling module must also not style the control through a state attribute alone (`data-selected:`, `[aria-expanded=true]`): style it with the selectors each component page lists, which include the native form. Any other call site keeps the interactive component; the page looks the same.

```tsx
import { Switch } from "@rivetjs/ui/switch";

// Native: plain props, nothing reads the state.
<Switch name="emails" defaultSelected label="Email me" />;

// Interactive: a handler needs the component.
<Switch label="Dark mode" onChange={(on) => setTheme(on)} />;
```

Keyboard and screen-reader behaviour are the browser's own for that element. Each component page has a "Zero-JS native path" section with the exact differences.

## Buttons with a simple handler

A Rivet UI `Button` whose `onPress` never reads its event becomes a plain `<button>` with a click listener. The page keeps the handler (it is your component's code) but loads no press, hover or focus code of the cdk Button. The build rewrites a call site when:

- `onPress` is an inline function, or one `const` function or function declaration in scope, that does not use its parameters, `this` or `arguments`,
- `variant`, `size`, `fullWidth`, `isIconOnly` and `radius` are constants, there is no `class`, spread or render-prop child, `type` is absent or `"button"`, other attributes are plain `data-*` / `aria-*` (`isDisabled` may be live),
- nothing above reads into the button (a `ButtonGroup`, a form, a trigger, a tooltip, a collection) and nothing inside reads what it provides,
- after the rewrite, no other Button on the same page still needs the cdk code (otherwise the page would load it anyway, and the site keeps the full Button).

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";

export function Counter() {
  const count = signal(0);
  // Never reads its event: this Button becomes <button onClick>.
  const add = () => count.update((n) => n + 1);
  return <Button onPress={add}>Add {count()}</Button>;
}
```

At those sites a press is a native click: Enter acts on keydown and Space on keyup, releasing the pointer outside the button still clicks, and there is no `data-pressed`, `data-hovered` or `data-focus-visible` (the Button stylesheet pairs each with `:active`, `:hover` and `:focus-visible`). The handler receives the native `MouseEvent`. A Button whose `onPress` reads the event (`(e) => …e.pointerType…`) keeps the full press behaviour.

::example{id=ui-counter}

The build reads `RIVET_NATIVE_LITE` from the environment: `RIVET_NATIVE_LITE=0` turns the rewrite off (to compare builds), `RIVET_NATIVE_LITE=all` rewrites every proven site even where the page would still load the cdk Button. `RIVET_LITE_TRACE=1` logs the reason for each site.

## Motion entrances

A `<Motion.*>` element whose `initial`, `animate`, `transition` and `reducedMotion` are literals, with no gestures, `whileInView`, `exit`, layout, variants, `style` or `ref`, and no `MotionConfig`, variant parent or presence above, compiles to the plain tag plus one CSS `@keyframes` rule in the page's stylesheet. The page ships no Motion code for it, even inside an interactive component. See [Motion](../motion/index.md#entrances-are-css).

## Variant classes

Rivet UI components compute their classes with tailwind-variants. At a call site whose variant props are constants and that passes no `class`, the build runs the real resolver and writes the resulting class string into the call. The page then ships neither the variant table nor the `tv` runtime for that component, and tailwind-merge only where a module passes a `class` override that it would change. A `class` prop, a live variant prop or a provider that sets variants (such as `ButtonGroup`) keeps the run-time resolver for that site.

The same build step evaluates other calls with constant arguments: tailwind-variants `tv`, `cn`, `cx`, and functions you mark with a `/** @comptime */` doc comment. Results that depend on time, randomness, locale or the environment are not evaluated ([RV2108](../../errors/RV2108.md)). See `comptime` in the [configuration reference](../../reference/config.md).

## The lite runtime

A component whose interactive part is simple (its own signals, handlers, text and attribute bindings, `model:` bindings, keyed lists of plain elements, data props, `<input>` / `<select>` values, conditional parts of plain elements) also gets a small chunk that updates the server's HTML directly. A page where every interactive component has one loads a runtime of a few kilobytes instead of the full one. In the [2026-10-28 real-pages run](https://github.com/N1XUS/rivetjs/blob/main/docs/benchmarks/2026-10-28-real-pages-jsdiet.md), the four application pages (products, dashboard, settings, article) each loaded 3.5 to 4.8 KB of JavaScript in one request before the first input, against 7.5 to 7.9 KB for Solid 1.9. The rules are in [Chunks](chunks.md).

## Components that start alone

The browser normally runs a component together with the components around it, so that the contexts they provide are there. Where a call site passes only data and the build proved that the component reads no context that anything above it may provide (its callers, the components around it in their JSX, the layouts up to the page), the component runs alone over its own nodes: the code of its parents and layouts is not needed for its first event ([Preloading](preloading.md#what-happens-by-default)). A component that reads a layout's context, or that receives a function prop, starts with its parent.

## Check a build

1. Build for production and serve the result.
2. Open the page with the Network panel filtered to **JS** and **Disable cache** on. A page with nothing interactive fetches no script; a page with only native controls fetches none either.
3. In the **Elements** panel, look at `<script type="rivet/boundaries">` near the end of `<body>`. A missing script or a missing `data-fo` attribute means nothing loads. `data-rt` names the runtime: the lite runtime when every interactive component has a lite chunk.
4. Native switches, checkboxes and accordions carry `data-native`; native buttons and tables are plain elements without `data-pressed`, `data-hovered` or a generated `id`.

See [Measuring](measuring.md) for the first-interaction check.

## Common mistakes

- **Passing a `class` to every Button.** A `class` prop keeps the run-time resolver and the full Button. Put layout classes on a wrapper, or define a variant.
- **Reading the event to do nothing with it.** `onPress={(e) => save()}` names a parameter it does not use, which still counts as reading nothing; `onPress={(e) => save(e)}` passes it on and keeps the full Button.
- **Styling native controls through state attributes.** `[data-selected]` does not match a native switch. Use the selectors the component page lists (`:has(input:checked)`, `[open]`).
- **Judging in the dev server.** None of this applies in dev.
