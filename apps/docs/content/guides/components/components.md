---
title: Components
description: Write components as functions, pass props and children, share signals with child components, and make components outside routes work in the browser.
template: guide
related: [learn/server-first, guides/components/events, gotchas/component-did-not-run-again]
---

A component is a function that returns JSX. After reading this page you can write components, pass data and children to them, and know the one rule that makes Rivet components different from React or Vue components: they run once per page: on the server, and in the browser only when they are first used, never when state changes.

## Write a component

```tsx title="src/components/Greeting.tsx"
export function Greeting({ name }: { name: string }) {
  return <p class="text-lg">Hello, {name}.</p>;
}
```

Use it in JSX like an HTML tag. Component names start with a capital letter:

```tsx title="src/routes/index.tsx"
import { Greeting } from "../components/Greeting.tsx";

export default function Page() {
  return (
    <main>
      <Greeting name="Ada" />
    </main>
  );
}
```

Write HTML attributes as in HTML: `class`, `for`, `aria-label`. Rivet also accepts `className` and `htmlFor`. Some attribute names are camelCase in the types, like `autoComplete`, `autoFocus` and `tabIndex`. The full list is in the [JSX reference](/reference/jsx.md).

## A component runs once

On a server-rendered page, the component function runs on the server to produce HTML. In the browser it runs once, the first time the component is used, over that HTML. When you click a button, Rivet runs only the click handler and updates only the parts of the page that read a changed signal. This is what lets the browser skip most JavaScript until you interact. See [Server first](/learn/server-first.md).

What this means for your code:

- Code at the top of a component runs on the server and can run again when the browser adopts it. A `console.log` there can print in both places; it does not run on each signal update.
- Browser globals like `window` and `document` are not available there. The compiler stops with ``Browser global `document` is read during server rendering``. See [browser-only code](./browser-only.md).
- A component runs in the browser only when it is used, from the signal values and props the server wrote into the page. See [resuming](/learn/resuming.md).

## Props

Props are the first argument, as one object. Type them and read them as `props.name`:

```tsx
export function Price(props: { cents: number; currency?: string }) {
  return <span>{(props.cents / 100).toFixed(2)} {props.currency ?? "USD"}</span>;
}
```

Spread works on components and elements. `<Card a={1} {...rest} />` builds one props object, and `<input {...props} />` sets every key as an attribute. Keys merge in source order, so the later one wins. See [spread props and style](/gotchas/spread-props-and-style.md).

## Props are live

Props stay live when the caller passes a reactive value, such as `count={messages()}`. Passing a literal or a previously read snapshot does not make it reactive. The compiler turns a prop that reads a signal into a getter, so a binding that reads `props.name` tracks the signal itself. The component function does not run again; only the bindings that read the prop re-run:

::example{id=component-props}

```tsx title="src/components/Badge.tsx"
export function Badge(props: { label: string; count: number }) {
  return (
    <span>
      {props.label} <b>{props.count}</b>
    </span>
  );
}
```

```tsx
import { signal } from "@rivetjs/reactivity";

const messages = signal(0);
<Badge label="Messages" count={messages()} />; // <b> follows messages
```

Rules:

- **Read props where you show them.** `props.count` inside JSX, `computed`, handlers or effects stays live. `const n = props.count;` in the component body reads once.
- **Destructuring reads once.** `function Badge({ count }) { … {count} … }` copies the value when the component is created and loses updates. Use `props.count`, or `splitProps` / `mergeProps` to forward and default props.
- **JSX spreads stay live, object spreads do not.** `<button {...props} />` and `<Card {...props} />` follow later changes. A JavaScript object spread (`const copy = { ...props }`, `Object.assign`) reads every getter once. Use `mergeProps` and `splitProps` to combine or split props without reading them.
- **Accessor props still work.** A prop typed `() => number` (`count={messages}`) is just a function the child calls. Use it for values the child also writes (`Signal<number>`), or when you want an explicit accessor.
- **Getters re-run on every read.** A prop holding JSX (`icon={<Star />}`) creates new nodes each time the child reads it. Read it once, or pass a render function.
- **Resumed pages.** The parent rebuilds live getters when it adopts, and the child reads those getters as in a client render. Destructuring or copying a prop still reads it once; resuming does not make that snapshot reactive. Use `props.count` in the binding that should update.

```tsx
import { mergeProps, splitProps } from "@rivetjs/runtime/props";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export function Button(props: { size?: "sm" | "md"; class?: string; children?: Content }) {
  const merged = mergeProps({ size: "md" }, props); // defaults, still live
  const [own, rest] = splitProps(merged, ["size"]);
  return <button class={`btn-${own.size}`} {...rest} />;
}
```

## Children

Content between the tags arrives as the `children` prop. Put it where you want it:

```tsx title="src/components/Card.tsx"
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export function Card(props: { title: string; children?: Content }) {
  return (
    <section class="rounded-lg border p-4">
      <h2 class="font-semibold">{props.title}</h2>
      {props.children}
    </section>
  );
}
```

```tsx
<Card title="Today">
  <p>Nothing planned.</p>
</Card>
```

A function child renders lazily and follows the signals its body reads, also on a resumed page: `<Card title="Cart">{() => <p>{items().length} items</p>}</Card>`. Render it with `{props.children}` directly. Copying a getter into a local variable reads that getter once; the function itself still tracks signal reads when rendered.

For several places for content (a header, a footer, a template per row), use [slots](./slots.md).

## Components outside src/routes

Components need no registration. `rivetRouter` resumes route files and every `.tsx` / `.jsx` component file a route imports, wherever it lives (`resume.appModules`, on by default). Only with `resume: { appModules: false }` do you list other component files yourself; an unlisted component then renders on the server, but its handlers do nothing:

```ts title="vite.config.ts"
import { defineConfig } from "vite";
import { rivetRouter } from "@rivetjs/router/vite";

export default defineConfig({
  plugins: [rivetRouter({ resume: { appModules: false, modules: ["src/components/Card.tsx"] } })],
});
```

See [Vite setup](/guides/tooling/vite.md#resume-options).

## Common mistakes

- **Expecting the component to run again.** It does not. Put changing values in signals and read them in JSX. See [the component did not run again](/gotchas/component-did-not-run-again.md).
- **Destructuring props.** `function Badge({ count })` copies `count` once. Read `props.count`. See [props are live](#props-are-live).
- **Passing `count` when the child wants a value.** `count={count}` passes the signal itself; the child must call it (`props.count()`). Pass `count={count()}` for a live value, and the signal only when the child writes it.
- **Turning off `resume.appModules` and not listing the file.** The page renders, but clicks do nothing.
- **Using `style="..."`.** Style strings are compile errors. Use classes, a style object (`style={{ color: c() }}`) or `style:color={c()}`. See [spread props and style](/gotchas/spread-props-and-style.md).

## See also

- [Events](./events.md)
- [Conditional rendering](./conditional.md)
- [Lists](./lists.md)
- [Context](./context.md): share values without passing props through every level.
