---
title: Coming from React
description: "What works differently in @rivetjs/ui if you know React component libraries: class, onPress, signals and live props, resumable handlers, no hydration."
template: guide
status: experimental
related: [start/introduction, components/overview]
---

If you have used a React component library built on React Aria, most of `@rivetjs/ui` will look familiar: compound parts, `data-slot` attributes, BEM class strings, `isDisabled` / `onPress` prop names. The points below are where Rivet works differently. Component pages note their own specifics.

## JSX

- **`class`, not `className`.** `className` is not accepted.
- **cdk events.** Interactive components fire `onPress` (covers mouse, touch, keyboard and screen readers), `onHoverStart`, `onFocusChange` and the other React Aria-style events. Use `onPress` rather than `onClick`.
- **Render props get accessors.** When `class` or `children` is a function, it receives `({ isPressed }) => isPressed()`: call the accessor, there are no snapshot booleans.
- **Children are slots.** A pattern like `children ?? <DefaultIcon />` only falls back on `null` in React. Here any child expression replaces the default; leave children out to keep a default icon.
- **No element cloning.** Groups do not clone their direct children to inject props. They provide a context that any descendant reads (see [ButtonGroup](../components/button-group.md)).

## State

- **Live props.** `variant={variant()}`, `isDisabled={busy()}`, `value={progress()}` are passed as getters; the component updates its classes and attributes in place, also on a resumed page. A few props are read once: those that choose the element (`Separator orientation`, `Typography type` / `level`) and the options state is built from (`default*`, `selectionMode`). Attributes and ranges stay live (a password field's `type`, `placeholder`, NumberField `step`, Slider `minValue` / `maxValue` / `step`).
- **Signals for two-way state.** `isSelected` (ToggleButton) and `selectedKeys` (ToggleButtonGroup) accept a signal and write changes back to it. A plain value such as `isSelected={on()}` is controlled: displayed, never written back, and updated in place when the expression changes. The same holds for controlled `value={qty()}` (NumberField, NumberStepper, RadioGroup, the color and date fields, …), `selectedKeys={keys()}`, `expandedKeys={keys()}` and `isOpen={open()}` ([cdk list](site:cdk/start/resumability/#props-update-in-place)).
- **Resumable components.** Nothing runs on load; a component runs over the server HTML the first time it is used ([resuming](site:docs/learn/resuming/)).

```tsx
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";

export default function Switcher() {
  const variant = signal<"default" | "secondary">("default");
  return (
    <Card variant={variant()}>
      <Card.Content>
        <Button onPress={() => variant.set(variant() === "default" ? "secondary" : "default")}>Switch</Button>
      </Card.Content>
    </Card>
  );
}
```

## Rendering

- **No hydration.** The server HTML stays in place. `useIsHydrated` and `useMounted` exist for API parity but return an accessor that is `false` on the server and `true` once the browser ran the client effects (see [Hooks](/start/hooks/)); `useIsSSR` is not ported (check `typeof document` or use `useMounted`). Hooks are plain functions that return accessors, not React hooks.
- **Avatar images load on the client.** The server renders the fallback; the image replaces it once loaded.
- **Icons are lucide.** Built-in icons (alert indicators, spinner, close and external-link icons) render through `@rivetjs/kit/icon` with lucide glyphs and keep their `data-slot` attributes. They are stroked, not filled.
- **Close buttons align with the header.** `CloseTrigger` in a Drawer, Modal, AlertDialog or Sheet is vertically centred on the header's first row (the heading, or a leading icon or back button) instead of sitting at a fixed corner offset. Browsers without CSS anchor positioning fall back to the corner position.

## Coverage

[All components](/components/overview/) lists what ships. Component pages are added together with their implementation.
