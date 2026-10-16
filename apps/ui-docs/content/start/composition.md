---
title: Composition
description: "Compose @rivetjs/ui: compound parts, named exports, variant functions and BEM classes on any element, custom variants and the render prop."
template: guide
status: experimental
related: [start/styling, start/design-principles]
---

There are three ways to get the library's look onto an element: use the component, call its variant function, or write its BEM classes. This page covers each, then how to build your own components and variants on top. Links are plain `<a>` elements throughout: the Rivet router handles same-origin links itself.

## Styles without components

The variant functions (`buttonVariants`, `linkVariants`, …) are plain functions that return class strings. They come from the stylesheet package, which has no component code and no framework dependency besides `tailwind-variants`:

```tsx
// Import from the component subpath (re-exports the styles function)
import { buttonVariants } from "@rivetjs/ui/button";

// Or from the styles entry itself (no component code)
import { buttonVariants } from "@rivetjs/ui/styles/src/index.ts";
```

Both return the same function. Use the component subpath in app code; the styles entry suits code that only needs class names.

## Style any element

Variant functions and BEM classes work on native elements, router links and your own components alike.

**A link that looks like a button:**

```tsx
import { buttonVariants } from "@rivetjs/ui/button";

// Style a router link as a primary button
<a class={buttonVariants({ variant: "primary" })} href="/about">
  About
</a>

// Style an external anchor as a secondary button with custom size
<a class={buttonVariants({ variant: "secondary", size: "lg" })} href="https://example.com">
  External Link
</a>
```

**The same with BEM classes:**

```tsx
// Apply button styles directly using BEM classes
<a class="button button--primary" href="/about">
  About
</a>
```

**Parts under your own root:**

Parts normally get their classes from the root's context. If you replace the root with your own element, that context is missing, so give each part its class yourself, from the variant function's slots or as BEM classes:

```tsx
import { Link, linkVariants } from "@rivetjs/ui/link";

// With custom root - pass class manually
const slots = linkVariants();

<a class={slots.base()} href="/about">
  About Page
  <Link.Icon class={slots.icon()} />
</a>

<a class="link" href="/about">
  About Page
  <Link.Icon class="link__icon" />
</a>
```

## BEM classes

Writing the [BEM](https://getbem.com/) classes is the shortest route, and it works in any framework and in static HTML.

**Router link:**

```tsx
<a class="button button--tertiary" href="/">
  Return Home
</a>
```

**Native anchor:**

```tsx
<a class="button button--primary" href="/dashboard">
  Go to Dashboard
</a>
```

**Button classes:**

- `.button`: base styles
- `.button--primary`, `.button--secondary`, `.button--tertiary`, `.button--outline`, `.button--ghost`, `.button--danger`, `.button--danger-soft`: variants
- `.button--sm`, `.button--md`, `.button--lg`: sizes
- `.button--icon-only`: icon-only button

Classes give you the look only. Use the component when you need its behaviour (`onPress`, focus handling, ARIA).

## Variant functions

Variant functions add type checking to the class route: options are typed unions, and slot functions name each part. Every component subpath re-exports its function.

**Router link with link slots:**

```tsx
import { Link, linkVariants } from "@rivetjs/ui/link";

const slots = linkVariants();

<a class={slots.base()} href="/about">
  About Page
  <Link.Icon class={slots.icon()} />
</a>;
```

**Button styles:**

```tsx
import { buttonVariants } from "@rivetjs/ui/button";

<a class={buttonVariants({ variant: "primary", size: "md" })} href="/dashboard">
  Dashboard
</a>;
```

Each component exports its function (`buttonVariants`, `chipVariants`, `linkVariants`, `spinnerVariants`, …) from its subpath; `@rivetjs/ui/styles/src/index.ts` exports all of them, including those for components without a Rivet implementation yet.

## Compound components

Most components are made of parts. The same component can be written three ways, and all three render identical DOM.

**Dot members on the main export (recommended):**

```tsx
import { Alert } from "@rivetjs/ui/alert";

<Alert>
  <Alert.Indicator />
  <Alert.Content>
    <Alert.Title>Success</Alert.Title>
    <Alert.Description>Your changes have been saved.</Alert.Description>
  </Alert.Content>
</Alert>;
```

**Explicit `.Root`:**

```tsx
<Alert.Root>
  <Alert.Indicator />
  <Alert.Content>
    <Alert.Title>Success</Alert.Title>
    <Alert.Description>Your changes have been saved.</Alert.Description>
  </Alert.Content>
</Alert.Root>
```

**Named exports:**

```tsx
import { AlertRoot, AlertIndicator, AlertContent, AlertTitle, AlertDescription } from "@rivetjs/ui/alert";

<AlertRoot>
  <AlertIndicator />
  <AlertContent>
    <AlertTitle>Success</AlertTitle>
    <AlertDescription>Your changes have been saved.</AlertDescription>
  </AlertContent>
</AlertRoot>;
```

The forms can be mixed inside one component:

```tsx
<Alert>
  <Alert.Indicator />
  <Alert.Content>
    <AlertTitle>Success</AlertTitle>
    <AlertDescription>Your changes have been saved.</AlertDescription>
  </Alert.Content>
</Alert>
```

Single-part components such as `Button` offer the same three spellings:

```tsx
import { Button, ButtonRoot } from "@rivetjs/ui/button";

// Recommended - no .Root needed
<Button>Click me</Button>

// Or with .Root
<Button.Root>Click me</Button.Root>

// Or named export
<ButtonRoot>Click me</ButtonRoot>
```

Pick one style per codebase; the output does not change.

## Mixing components and styles

A component can wear another component's classes. Here a `Link` keeps its link behaviour but looks like a button:

```tsx
import { buttonVariants } from "@rivetjs/ui/button";
import { Link } from "@rivetjs/ui/link";

// Link styled with button variants
const buttonStyles = buttonVariants({ variant: "tertiary", size: "md" });

<Link class={buttonStyles} href="https://example.com">
  Example
</Link>;
```

## Your own components

Wrap the parts and variant functions in components of your own:

```tsx
import { splitProps } from "@rivetjs/runtime/props";
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "lucide";
import { Button, buttonVariants, type ButtonVariants } from "@rivetjs/ui/button";

// Link button component using variant functions
function LinkButton(props: ButtonVariants & { href: string; children?: unknown }) {
  const [local, rest] = splitProps(props, ["variant", "size", "fullWidth", "isIconOnly"]);
  return <a {...rest} class={buttonVariants({ variant: local.variant ?? "primary", size: local.size })} />;
}

// Icon-only button with an accessible label
function IconButton(props: { icon: IconNode; label: string }) {
  return (
    <Button isIconOnly aria-label={props.label}>
      <Icon icon={props.icon} size={16} />
    </Button>
  );
}
```

## Custom variants

Pass a component's variant function to `tv({ extend })` to add or override variants, then feed the result to `class`:

```tsx
import { splitProps } from "@rivetjs/runtime/props";
import { tv, type VariantProps } from "@rivetjs/ui";
import { Button, buttonVariants, type ButtonRootProps } from "@rivetjs/ui/button";

const myButtonVariants = tv({
  extend: buttonVariants,
  base: "text-md text-shadow-lg font-semibold shadow-md data-[pending=true]:opacity-40",
  variants: {
    radius: {
      lg: "rounded-lg",
      md: "rounded-md",
      sm: "rounded-sm",
      full: "rounded-full",
    },
    size: {
      sm: "h-10 px-4",
      md: "h-11 px-6",
      lg: "h-12 px-8",
      xl: "h-13 px-10",
    },
    variant: {
      primary: "text-white dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
    },
  },
  defaultVariants: {
    radius: "full",
    variant: "primary",
  },
});

type MyButtonVariants = VariantProps<typeof myButtonVariants>;
export type MyButtonProps = Omit<ButtonRootProps, "class" | "size" | "variant"> & MyButtonVariants & { class?: string };

function CustomButton(props: MyButtonProps) {
  const [local, rest] = splitProps(props, ["class", "radius", "variant", "size"]);
  return <Button class={myButtonVariants({ class: local.class, radius: local.radius, variant: local.variant, size: local.size })} {...rest} />;
}

export function CustomVariants() {
  return <CustomButton>Custom Button</CustomButton>;
}
```

**Referring to component types.** Use named type imports, or index the component type.

Named type imports (recommended):

```tsx
import type { ButtonRootProps } from "@rivetjs/ui/button";
import type { AvatarRootProps } from "@rivetjs/ui/avatar";

type MyButtonProps = ButtonRootProps;
type MyAvatarProps = AvatarRootProps;
```

Indexed access:

```tsx
import type { Button } from "@rivetjs/ui/button";
import type { Avatar } from "@rivetjs/ui/avatar";

type MyButtonProps = Button["RootProps"];
type MyAvatarProps = Avatar["RootProps"];
```

`Button.RootProps` (namespace syntax) does not exist; use `Button["RootProps"]` or a named import.

## Replacing the DOM element

The `render` prop (provided by the cdk) swaps the element a component renders. It receives the DOM props to spread and the render state as accessors:

```tsx
<Button render={(domProps, { isPressed }) => <button {...domProps} style={{ transform: isPressed() ? "scale(0.9)" : "scale(1)" }} />}>Press me</Button>
```

::example{id=button-render-function}

It also lets you reuse an existing presentational element:

```tsx
<Link render={(domProps) => <a {...domProps} href="/privacy-policy" />}>Privacy Policy</Link>
```

Behaviour and accessibility depend on three rules:

- Keep the element type: where a `<button>` is expected, render a `<button>`, not an `<a>`.
- Return exactly one root element, never a fragment.
- Spread the given props onto that element; combine them with your own through `mergeProps` (`@rivetjs/cdk/utils`).

## Other routers and frameworks

**Rivet router:** a variant function gives typed options:

```tsx
<a class={buttonVariants({ variant: "primary" })} href="/dashboard">
  Dashboard
</a>
```

BEM classes are the shortest form:

```tsx
<a class="button button--primary" href="/dashboard">
  Dashboard
</a>
```

**React Router and other React code:** the variant functions return strings, so they work on its `Link` as `className={buttonVariants({ variant: "primary" })}`.

**Vue, Svelte and others:** the styles entry depends only on `tailwind-variants`, so its functions run anywhere:

```vue
<script setup>
import { buttonVariants } from "@rivetjs/ui/styles/src/index.ts";

const primaryButton = buttonVariants({ variant: "primary" });
</script>

<template>
  <button :class="primaryButton">Click me</button>
</template>
```

## Next steps

- [Styling](/start/styling/): classes, variables and states
- [Animation](/start/animation/): transitions and motion settings
- [Components](/components/overview/): every component with examples
