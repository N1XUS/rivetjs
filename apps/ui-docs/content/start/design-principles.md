---
title: Design Principles
description: "The rules behind @rivetjs/ui: variants named by intent, accessibility in the cdk, parts over prop lists, consistent props, styles separate from logic."
template: guide
status: experimental
related: [start/introduction, start/composition, start/styling]
---

The component APIs follow a small set of rules. Knowing them makes most components predictable before you open their page.

## Variants name intent, not appearance

A variant says what an action means (`primary`, `secondary`, `tertiary`, `danger`), not how it is drawn (solid, flat, bordered). The look can change with the theme; the meaning stays.

::example{id=button-variants}

```tsx
// Semantic variants communicate hierarchy
<Button variant="primary">Save</Button>
<Button variant="secondary">Edit</Button>
<Button variant="tertiary">Cancel</Button>
```

| Variant       | Use for                                | How often        |
| ------------- | -------------------------------------- | ---------------- |
| **Primary**   | The action that moves the user forward | One per context  |
| **Secondary** | Other available actions                | Several are fine |
| **Tertiary**  | Dismissing or skipping (cancel, skip)  | Sparingly        |
| **Danger**    | Destructive actions                    | When needed      |

## Accessibility lives in the cdk

The styled components do not implement interaction themselves. ARIA attributes, keyboard handling, focus management and screen reader behaviour come from [@rivetjs/cdk](site:cdk/), which ports React Aria's behaviour (targeting WCAG 2.1 AA).

```tsx
import { ToggleButton } from "@rivetjs/ui/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/ui/toggle-button-group";

<ToggleButtonGroup aria-label="Text alignment" selectionMode="single" defaultSelectedKeys={["left"]}>
  <ToggleButton id="left">Left</ToggleButton>
  <ToggleButton id="center">Center</ToggleButton>
  <ToggleButton id="right">Right</ToggleButton>
</ToggleButtonGroup>;
```

In this group, arrow keys move focus between buttons, `aria-pressed` reflects the selection, and the group carries its label as a toolbar with radio-group semantics.

## Parts instead of prop lists

A component is a set of parts you place yourself, so leaving out or reordering a piece never needs a new prop. Parts are available as dot members (`Card.Header`) and as named exports (`CardHeader`); both forms can be mixed.

```tsx
// Compose parts to build exactly what you need
import { CardRoot, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@rivetjs/ui/card";

<CardRoot>
  <CardHeader>
    <CardTitle>Question Text</CardTitle>
    <CardDescription>Short summary</CardDescription>
  </CardHeader>
  <CardContent>Answer content</CardContent>
  <CardFooter>Footer</CardFooter>
</CardRoot>;
```

## Start small, add as needed

Defaults cover the common case, so the minimal call is one tag. Size, variant, icons and state are added only when the screen needs them.

```tsx
import { Icon } from "@rivetjs/kit/icon";
import { Check } from "lucide";

// Level 1: Minimal
<Button>Click me</Button>

// Level 2: Enhanced
<Button variant="primary" size="lg">
  <Icon icon={Check} size={16} class="mr-2" />
  Submit
</Button>

// Level 3: Advanced (isLoading is a signal)
<Button variant="primary" isDisabled={isLoading()}>
  {isLoading() ? <><Spinner size="sm" class="mr-2" /> Loading...</> : "Submit"}
</Button>
```

## The same props everywhere

Sizes are `sm` / `md` / `lg`, every part accepts `class`, state is exposed as `data-*` attributes, and every compound component offers both the dot form and named exports.

```tsx
// All components follow the same patterns
<Button size="lg" variant="primary" class="custom" />
<Chip size="lg" color="success" class="custom" />
<Avatar size="lg" class="custom" />

// Compound components support both named exports and dot notation

// Named exports
<AlertRoot>
  <AlertIndicator />
</AlertRoot>

// Dot notation
<Alert>
  <Alert.Indicator />
</Alert>
```

## Typed end to end

Variant and size unions, event objects and part props are typed, so the editor completes them and the compiler rejects wrong values. Prop types are exported for wrappers.

```tsx
import { Button, type ButtonProps } from "@rivetjs/ui/button";

// Type-safe props and event handlers
<Button
  variant="primary" // Autocomplete: primary | secondary | tertiary | outline | ghost | danger | danger-soft
  size="md" // Type checked: sm | md | lg
  onPress={(e) => {
    // e is typed as the cdk PressEvent
    console.log(e.target);
  }}
/>;

// Extend types for custom components
interface CustomButtonProps extends Omit<ButtonProps, "variant"> {
  intent: "save" | "cancel" | "delete";
}
```

## Styles are independent of components

`@rivetjs/ui/styles` is plain CSS over class names, and the variant functions only build class strings. Neither needs the component code, so the same look applies to plain HTML or to elements you render yourself.

```html
<!-- Use with plain HTML -->
<button class="button button--primary">Click me</button>
```

In Rivet:

```tsx
import { buttonVariants } from "@rivetjs/ui/button";

// Apply styles to any element
<a class={buttonVariants({ variant: "primary" })} href="/home">
  Home
</a>;
```

## Feedback while you build

Rivet and the cdk print dev-only warnings, which production builds leave out. Every component page has live examples for its options.

## Customize at any level

Change the whole look with CSS variables, one component with its BEM classes, or a single instance with `class`. A theme preset swaps every variable at once through one attribute ([Themes](/start/themes/)):

::example{id=theme-swap}

```css
/* Theme-wide changes with variables */
:root {
  --accent: oklch(0.7 0.25 260);
  --radius: 0.375rem;
  --spacing: 0.5rem;
}

/* Component-specific customization */
@layer components {
  .button {
    @apply uppercase tracking-wider;
  }
  .button--primary {
    @apply bg-gradient-to-r from-purple-500 to-pink-500;
  }
}
```

## Extend instead of fork

Build on the library rather than copying it: reuse variant functions on your own elements, apply the BEM classes directly, wrap components, or extend their variants.

**Variant functions on any element:**

```tsx
import { linkVariants } from "@rivetjs/ui/link";
import { Icon } from "@rivetjs/kit/icon";
import { ArrowUpRight } from "lucide";

// Use variant functions to style any element, e.g. a plain router link
const slots = linkVariants();

<a class={slots.base()} href="/about">
  About Page
  <span class={slots.icon()}>
    <Icon icon={ArrowUpRight} size={16} />
  </span>
</a>;
```

**BEM classes directly:**

```tsx
// Apply the BEM classes directly to any element
<a class="button button--primary" href="/dashboard">
  Dashboard
</a>
```

**A wrapper component:**

```tsx
import { splitProps } from "@rivetjs/runtime/props";
import { Button, type ButtonProps } from "@rivetjs/ui/button";

type CTAButtonProps = Omit<ButtonProps, "variant"> & { intent?: "primary-cta" | "secondary-cta" | "minimal" };

const variantMap = { "primary-cta": "primary", "secondary-cta": "secondary", minimal: "ghost" } as const;

// Custom wrapper component: split own props off, forward the rest (stays reactive)
function CTAButton(props: CTAButtonProps) {
  const [local, rest] = splitProps(props, ["intent"]);
  return <Button variant={variantMap[local.intent ?? "primary-cta"]} {...rest} />;
}
```

**New variants with Tailwind Variants:**

```tsx
import { tv } from "@rivetjs/ui";
import { Button, buttonVariants } from "@rivetjs/ui/button";

// Extend button styles with custom variants
const myButtonVariants = tv({
  extend: buttonVariants,
  variants: {
    variant: {
      "primary-cta": "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg",
      "secondary-cta": "border-2 border-blue-500 text-blue-500 hover:bg-blue-50",
    },
  },
});

// Use the custom variants
<Button class={myButtonVariants({ variant: "primary-cta" })}>Get Started</Button>
<Button class={myButtonVariants({ variant: "secondary-cta" })}>Learn More</Button>
```

## Summary

| Aspect            | In @rivetjs/ui                                                |
| ----------------- | ------------------------------------------------------------- |
| **Animations**    | CSS transitions and keyframes, GPU-accelerated                |
| **Structure**     | Compound components                                           |
| **Variants**      | Semantic (primary, secondary, tertiary, danger)               |
| **Styling**       | Tailwind CSS v4                                               |
| **Accessibility** | From the cdk (React Aria behaviour)                           |
| **Bundle**        | Tree-shakeable, one subpath per component                     |
| **Customization** | CSS variables, BEM classes, `class`, variant functions, parts |
