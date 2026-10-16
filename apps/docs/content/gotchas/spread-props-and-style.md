---
title: Spread props and style
description: How {...props} merges attributes in Rivet JSX, which style forms are compile errors, and what to write instead.
template: gotcha
related: [reference/jsx, guides/styling/css-and-tailwind, guides/styling/scoped-styles]
---

## What you see

Code that is normal in React stops the build:

```tsx
export function Button(props: { label: string; class?: string }) {
  return <button {...props} style="color: teal">{props.label}</button>;
}
```

```txt
style strings are not supported: use a style object (style={{ color: c, "--x": v }}) or style:color={c}
```

A `style` key inside the spread object fails when the page renders: `Unsafe or unsupported native attribute: style`. `{...items}` as children stops the build too: `Spread children are not supported`.

The spread itself works. `{...props}` on an element merges its keys with the other attributes in source order, and the later one wins. Each key goes through the same checks as a normal attribute: `style`, `innerHTML` and `onclick="…"` strings throw, unsafe URLs render as `about:invalid#rivet`, and `onClick` functions become listeners. A `children` key becomes the element's content when the element has no JSX children of its own; JSX children win, as in React. When a reactive attribute on the spread element changes, its children are kept as they are (focus, input values and nested state survive); they are re-inserted only when the `children` value itself changes. A `ref` key works like a `ref` attribute. On a component, `<Card {...props} />` builds one props object.

## Why

A style string is CSS that Rivet cannot check, and a `style` attribute in the HTML is blocked by a strict Content Security Policy. Rivet accepts styles only as objects or `style:` attributes written on the element. It checks every property name and value: values with `url(`, `expression(`, `javascript:`, `;` and similar are refused. In the browser it sets them through CSSOM, which a strict policy allows.

## Fix

Write the style as an object, or one property with `style:`. Put attributes you want to win after the spread:

```tsx
export function Button(props: { label: string; class?: string; disabled?: boolean }) {
  return (
    <button {...props} class={["btn", props.class]} style={{ color: "teal" }}>
      {props.label}
    </button>
  );
}
```

`class:` toggles work next to a spread as well: `<button {...props} class:active={on()}>` adds or removes `active` on the class that comes from the spread.

`style:` attributes next to a spread join it as one `style` object at the position of the first one: `<div {...props} style:transform={t()}>` replaces a `style` from `props`, and `<div style:transform={t()} {...props}>` lets the spread's `style` win, like any other key.

To pass a style through props, pass it as an object and write it on the element: `style={props.style}`. Do not leave it inside the spread object.

For a value that changes at runtime, set a custom property and read it in CSS:

```tsx
import { signal } from "@rivetjs/reactivity";

export function Meter() {
  const level = signal(20);
  return (
    <div class="meter" style={{ "--level": level() + "%" }}>
      <button onClick={() => level.set(80)}>Raise</button>
    </div>
  );
}
```

```css
.meter { background: linear-gradient(90deg, #0f766e var(--level), #ccfbf1 0); }
```

For a fixed set of states, a `data-` attribute styled in CSS (`.meter[data-level="high"]`) or a class per state keeps the first paint free of inline styles. See [CSS and Tailwind](../guides/styling/css-and-tailwind.md#change-other-styles-style-objects-css-variables-and-data-attributes).
