---
title: UI components (preview)
description: "@rivetjs/ui: a 1:1 port of HeroUI v3 on Rivet. 20 components ship so far (Card, Button, Link, Chip, Badge, Alert, Avatar, Typography, field primitives…)."
template: guide
status: experimental
related: [ui/overview, ui/kit, guides/styling/css-and-tailwind]
---

`@rivetjs/ui` is a port of [HeroUI](https://www.heroui.com/) v3.2.6 to Rivet: styled compound components built on the accessible `@rivetjs/cdk` components, with HeroUI's CSS and Tailwind v4. It is a **preview**: the package is not on npm yet, and the component list is still short (20 of HeroUI's 86 directories).

After reading this page you know what is available, how the API maps from HeroUI, and which rules differ from React.

:::tip
The [@rivetjs/ui docs site](site:ui/) has a page per component with live examples in the HeroUI stylesheet, installation, theming and dark-mode guides, and the API reference.
:::

## What ships

| Subpath | Parts | Page |
| --- | --- | --- |
| `@rivetjs/ui/surface` | `Surface` | — |
| `@rivetjs/ui/card` | `Card`, `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer` | — |
| `@rivetjs/ui/button` | `Button` | [Button](components/button.md) |
| `@rivetjs/ui/close-button` | `CloseButton` | [Button](components/button.md) |
| `@rivetjs/ui/button-group` | `ButtonGroup`, `ButtonGroup.Separator` | [Button](components/button.md) |
| `@rivetjs/ui/toggle-button` | `ToggleButton` | — |
| `@rivetjs/ui/toggle-button-group` | `ToggleButtonGroup`, `ToggleButtonGroup.Separator` | — |
| `@rivetjs/ui/link` | `Link`, `Link.Icon` | [Link](components/link.md) |
| `@rivetjs/ui/chip` | `Chip`, `Chip.Label` | [Chip](components/chip.md) |
| `@rivetjs/ui/badge` | `Badge`, `Badge.Anchor`, `Badge.Label` | [Badge](components/badge.md) |
| `@rivetjs/ui/alert` | `Alert`, `Alert.Indicator`, `Alert.Content`, `Alert.Title`, `Alert.Description` | [Alert](components/alert.md) |
| `@rivetjs/ui/avatar` | `Avatar`, `Avatar.Image`, `Avatar.Fallback` | [Avatar](components/avatar.md) |
| `@rivetjs/ui/avatar-group` | `AvatarGroup`, `AvatarGroup.Count` | [Avatar](components/avatar.md) |
| `@rivetjs/ui/typography` | `Typography`, `Typography.Heading`, `Typography.Paragraph`, `Typography.Code`, `Typography.Prose` | [Typography](components/typography.md) |
| `@rivetjs/ui/kbd` | `Kbd`, `Kbd.Abbr`, `Kbd.Content` | [Kbd](components/kbd.md) |
| `@rivetjs/ui/spinner` | `Spinner` | [Spinner](components/spinner.md) |
| `@rivetjs/ui/skeleton` | `Skeleton` | [Skeleton](components/skeleton.md) |
| `@rivetjs/ui/empty-state` | `EmptyState` | [Empty state](components/empty-state.md) |
| `@rivetjs/ui/separator` | `Separator` | [Separator](components/separator.md) |
| `@rivetjs/ui/label` | `Label` | [Field primitives](components/field-primitives.md) |
| `@rivetjs/ui/description` | `Description` | [Field primitives](components/field-primitives.md) |
| `@rivetjs/ui/error-message` | `ErrorMessage` | [Field primitives](components/field-primitives.md) |
| `@rivetjs/ui/field-error` | `FieldError` | [Field primitives](components/field-primitives.md) |
| `@rivetjs/ui/header` | `Header` | [Field primitives](components/field-primitives.md) |
| `@rivetjs/ui/progress-bar` | `ProgressBar`, `ProgressBar.Output`, `ProgressBar.Track`, `ProgressBar.Fill` | — |
| `@rivetjs/ui/progress-circle` | `ProgressCircle`, `ProgressCircle.Track`, `ProgressCircle.TrackCircle`, `ProgressCircle.FillCircle` | — |
| `@rivetjs/ui/meter` | `Meter`, `Meter.Output`, `Meter.Track`, `Meter.Fill` | — |
| `@rivetjs/ui/scroll-shadow` | `ScrollShadow` (+ `useScrollShadow`) | [Scroll shadow](components/scroll-shadow.md) |
| `@rivetjs/ui/styles` | The CSS (needs Tailwind v4) | — |

Every component also has a `.Root` alias (except `Header`), named exports (`ButtonRoot`, `CardHeader`, …), its prop types and its `tailwind-variants` definition (`buttonVariants`, …). The root `@rivetjs/ui` barrel re-exports all of them plus `dom`, `tv`, `cn` and `VariantProps`, but importing the subpath keeps the module graph small.

More components follow the upstream list. Each one has its own subpath, so a component you do not import adds nothing to your page. Not ported yet: the HeroUI hooks (`useIsHydrated`, `useTheme`, …) and the `rac` re-exports.

## Use a card

```tsx nocheck
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";

export default function Page() {
  const variant = signal<"default" | "secondary">("default");
  return (
    <Card variant={variant()} class="w-[320px]">
      <Card.Header>
        <Card.Title>Live</Card.Title>
        <Card.Description>{variant()}</Card.Description>
      </Card.Header>
      <Card.Content>
        <button onClick={() => variant.set("secondary")}>Switch</button>
      </Card.Content>
    </Card>
  );
}
```

Load the styles once, from your stylesheet, after Tailwind: `@import "@rivetjs/ui/styles";`.

## Differences from React HeroUI

- Use `class`, not `className`.
- Props can change over time: pass `variant={variant()}` and the card updates in place, keeping focus and state inside it.
- Event handlers must be inline arrows or local consts, as everywhere in Rivet. See [serializable captures](../best-practices/serializable-captures.md).
- Behaviour (focus, keyboard, overlays) comes only from `@rivetjs/cdk`. See the [UI overview](overview.md).
- Interactive components (`Button`, `Link`) take the cdk events: `onPress` rather than `onClick`. `isDisabled` / `isPending` accept a signal.
- Inline SVG icons from HeroUI (alert indicators, spinner, close and external-link icons) are lucide icons here; the `data-slot` attributes are the same.
- Variant props (`color`, `size`, `variant`, `status`) reach the parts through resumable contexts, so parts inside a resumed page keep their classes without a re-render.

Each component page lists its own differences.

## See also

- [UI overview](overview.md)
- [CSS and Tailwind](../guides/styling/css-and-tailwind.md)
