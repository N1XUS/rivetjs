---
title: Typography
description: "A semantic typography primitive for headings, body copy, and inline code built on React Aria Components Text."
template: reference
status: experimental
related: []
---

`Typography` renders text in the Rivet UI type scale. The element follows `type`: `h1`…`h6`, `p` for body sizes, `code`.

Notes:

- `class`, not `className`.
- Headings and code go through the cdk Text dynamic element: no resumable event handlers on them.
- `Typography.Prose` takes `render`.

Accessibility: Headings are real heading elements (cdk Text with `elementType`): choose `level` for the outline and `type` / `class` for the look.

## Usage

```tsx
import { Typography } from "@rivetjs/ui/typography";
```

::example{id=typography-default}

## Anatomy

`Typography` maps visual `type` values to semantic elements by default.

```tsx
import { Typography } from "@rivetjs/ui/typography";

export default () => <Typography type="h1">Heading</Typography>;
```

## Examples

### Scale

::example{id=typography-typography-scale}

### Primitives

::example{id=typography-primitives}

- `Typography.Heading` maps `level={1..6}` to `type="h1"` through `type="h6"`.
- `Typography.Paragraph` maps `size="base" | "sm" | "xs"` to body text styles.
- `Typography.Code` maps to the inline code style.
- `Typography.Prose` styles rich content passed as regular HTML children.

### Prose

::example{id=typography-prose}

### Render Props

::example{id=typography-render-props}

Use the React Aria Components-style `render` prop when you need to customize the rendered element.

### Type Tokens

The tokens behind the styles: the Tailwind type scale with each step's size and line height, the weights, the sans and mono families, and tabular figures (`tabular-nums`) for numbers in columns. Values are read from the page's CSS.

::example{id=tokens-typography}

## Customization

### Tailwind CSS

::example{id=typography-custom-styles}

### Global CSS

To customize the Typography component classes, you can use the `@layer components` directive. [Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .typography--h1 {
    @apply font-extrabold tracking-tight;
  }

  .typography--code {
    @apply rounded-md bg-default-100 font-mono dark:bg-default-50/20;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Typography component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/typography.css)):

#### Base Classes

- `.typography` - Base typography primitive
- `.typography-prose` - Rich prose container

#### Type Classes

- `.typography--h1` through `.typography--h6`
- `.typography--body`, `.typography--body-sm`, `.typography--body-xs`
- `.typography--code`

#### Modifier Classes

- `.typography--align-start`, `.typography--align-center`, `.typography--align-end`, `.typography--align-justify`
- `.typography--color-default`, `.typography--color-muted`
- `.typography--truncate`
- `.typography--weight-normal`, `.typography--weight-medium`, `.typography--weight-semibold`, `.typography--weight-bold`

## API Reference

### Typography

| Prop       | Type                                                                                         | Default     | Description                                   |
| ---------- | -------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------- |
| `type`     | `'h1' \| 'h2' \| 'h3' \| 'h4' \| 'h5' \| 'h6' \| 'body' \| 'body-sm' \| 'body-xs' \| 'code'` | `'body'`    | Semantic typography style.                    |
| `align`    | `'start' \| 'center' \| 'end' \| 'justify'`                                                  | `'start'`   | Text alignment.                               |
| `color`    | `'default' \| 'muted'`                                                                       | `'default'` | Text color.                                   |
| `weight`   | `'normal' \| 'medium' \| 'semibold' \| 'bold'`                                               | -           | Font weight override.                         |
| `truncate` | `boolean`                                                                                    | -           | Truncates the text to one line with ellipsis. |
| `render`   | `DOMRenderFunction`                                                                          | -           | Custom render function from React Aria.       |
| `children` | `Content`                                                                                    | -           | Text content.                                 |

::api{symbol="@rivetjs/ui/typography#TypographyRootProps"}

## Related Components
