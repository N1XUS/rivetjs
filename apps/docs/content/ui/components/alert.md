---
title: Alert
description: "@rivetjs/ui Alert: a status message with Indicator, Content, Title and Description parts and a default lucide icon per status."
template: reference
status: experimental
related: [ui/heroui-port, ui/components/button]
---

`Alert` shows a message with a status. Its parts are `Alert.Indicator` (an icon, chosen by status when empty), `Alert.Content`, `Alert.Title` and `Alert.Description`. Port of HeroUI v3.2.6 [Alert](https://www.heroui.com/docs/components/alert).

## Import

```tsx
import { Alert } from "@rivetjs/ui/alert";
```

## Usage

```tsx
import { Alert } from "@rivetjs/ui/alert";
import { CloseButton } from "@rivetjs/ui/close-button";

export default function Page() {
  return (
    <Alert status="success">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Saved</Alert.Title>
        <Alert.Description>Your changes are live.</Alert.Description>
      </Alert.Content>
      <CloseButton onPress={() => console.log("dismiss")} />
    </Alert>
  );
}
```

Pass children to `Alert.Indicator` to use your own icon.

## Variants

`alertVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `status` | `default`, `accent`, `success`, `warning`, `danger` | `default` |

Default indicator icons (lucide, 16px, `data-slot="alert-default-icon"`): `Info` for `default` and `accent`, `CircleCheck` for `success`, `TriangleAlert` for `warning`, `CircleAlert` for `danger`.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Alert` / `Alert.Root` | `div` | `alert-root` |
| `Alert.Indicator` | `div` | `alert-indicator` |
| `Alert.Content` | `div` | `alert-content` |
| `Alert.Title` | `p` | `alert-title` |
| `Alert.Description` | `span` | `alert-description` |

The root provides `SurfaceContext` with `variant: "default"` to the parts inside it. All parts are generic over the element.

## Accessibility

Alert is plain markup without cdk behaviour: it adds no `role`. For a message that appears after an action, set `role="alert"` or `role="status"` on the root yourself so screen readers announce it.

## Differences from HeroUI React

- `class`, not `className`.
- Default indicator icons are lucide (stroked) instead of HeroUI's filled inline SVGs.
- `status` reaches the parts through a resumable context.
