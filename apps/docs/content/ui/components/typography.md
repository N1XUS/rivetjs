---
title: Typography
description: "@rivetjs/ui Typography: headings, paragraphs, code and prose with type, align, color, weight and truncate variants, on the cdk Text."
template: reference
status: experimental
related: [ui/heroui-port]
---

`Typography` renders text with HeroUI's type scale. The element follows `type`: `p` for body sizes, `code`, `h1` to `h6`. Shorthand parts: `Typography.Heading`, `Typography.Paragraph`, `Typography.Code`, `Typography.Prose`. Port of HeroUI v3.2.6 [Typography](https://www.heroui.com/docs/components/typography).

## Import

```tsx
import { Typography } from "@rivetjs/ui/typography";
```

## Usage

```tsx
import { Typography } from "@rivetjs/ui/typography";

export default function Page() {
  return (
    <article>
      <Typography.Heading level={2}>Release notes</Typography.Heading>
      <Typography.Paragraph color="muted" size="sm">
        Shipped on Tuesday.
      </Typography.Paragraph>
      <Typography type="body" weight="semibold" truncate>
        A long line that is cut with an ellipsis when it does not fit.
      </Typography>
      <Typography.Code>npm run build</Typography.Code>
    </article>
  );
}
```

`Typography.Prose` wraps long-form HTML (`div`, class `typography-prose`) so headings, lists and code inside it are styled.

## Variants

`typographyVariants`:

| Prop | Values | Default |
| --- | --- | --- |
| `type` | `body`, `body-sm`, `body-xs`, `code`, `h1`, `h2`, `h3`, `h4`, `h5`, `h6` | `body` |
| `align` | `start`, `center`, `end`, `justify` | `start` |
| `color` | `default`, `muted` | `default` |
| `weight` | `normal`, `medium`, `semibold`, `bold` | none |
| `truncate` | `true` | none |

Shorthands: `Heading level={1…6}` sets `type` to `h<level>` (default `1`); `Paragraph size` of `base`, `sm` or `xs` sets `type` to `body`, `body-sm` or `body-xs` (default `base`); `Code` sets `type="code"`.

## Parts

| Part | Element | `data-slot` |
| --- | --- | --- |
| `Typography` / `Typography.Root` | by `type` | `typography` (+ `data-type`) |
| `Typography.Heading` | `h1`…`h6` | `typography` |
| `Typography.Paragraph` | `p` | `typography` |
| `Typography.Code` | `code` | `typography` |
| `Typography.Prose` | `div` | `prose` |

The parts are not generic over the element; the element comes from `type`.

## Accessibility

The root uses the cdk `Text` part with `elementType`, so a heading is a real heading element. Choose `level` for document structure, not for size: set `type` or `class` for the look.

## Differences from HeroUI React

- `class`, not `className`.
- Headings go through cdk `Text`'s dynamic element branch: they cannot carry resumable event handlers.
- `Typography.Prose` accepts `render` (it is a `dom.div`); HeroUI types it as plain `div` props.
