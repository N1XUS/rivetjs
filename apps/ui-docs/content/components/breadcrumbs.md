---
title: Breadcrumbs
description: "Navigation breadcrumbs showing the current page's location within a hierarchy."
template: reference
status: experimental
related: [components/link]
---

`Breadcrumbs` shows where the current page sits in a hierarchy. The root is the [cdk Breadcrumbs](site:cdk/components/breadcrumbs/) (an `<ol>` collection); each `Breadcrumbs.Item` is a cdk `Breadcrumb` with a [Link](link.md) inside and a separator after every item but the last.

Notes:

- `class`, not `className`. Render props are accessors (`isCurrent()`).
- The default separator is the lucide `ChevronRight` icon. A custom `separator` is not cloned: it renders inside a `span` carrying `breadcrumbs__separator` + `data-slot="breadcrumbs-separator"`; pass a function (`separator={() => <… />}`) to build one per item (an element value is cloned per item).
- The custom-separator demo uses the lucide `Play` icon instead of the hand-written caret SVG.
- Extras: an [InlineSelect](inline-select.md) as a breadcrumb ([Inline Select](#inline-select)), and collapsing the breadcrumbs that do not fit ([Overflow](#overflow)).

Accessibility: an ordered list of links; the last item gets `aria-current="page"` and is not interactive; `isDisabled` disables every link (`aria-disabled`).

## Usage

```tsx
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
```

::example{id=breadcrumbs-basic}

## Anatomy

```tsx
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";

export default () => (
  <Breadcrumbs>
    <Breadcrumbs.Item href="#">Home</Breadcrumbs.Item>
    <Breadcrumbs.Item href="#">Category</Breadcrumbs.Item>
    <Breadcrumbs.Item>Current Page</Breadcrumbs.Item>
  </Breadcrumbs>
);
```

## Examples

### Navigation Levels

::example{id=breadcrumbs-level-2}

::example{id=breadcrumbs-level-3}

### Disabled State

::example{id=breadcrumbs-disabled}

### Custom Separator

::example{id=breadcrumbs-custom-separator}

### Render Function

::example{id=breadcrumbs-render-function}

### Inline Select

A function child replaces an item's link with your own content: here an [InlineSelect](inline-select.md) switches the project without leaving the trail. The child gets `{ isCurrent, isDisabled, separator }`; call `separator()` to keep the chevron after it. The select trigger is the breadcrumb's focusable control (`aria-label="Project"`, Tab order unchanged), the last item stays the current page (`aria-current="page"`).

::example{id=breadcrumbs-inline-select}

### Items

Rivet addition: `items` without a render function render one `Breadcrumbs.Item` per `{ label, href?, id?, isDisabled? }` entry (key = `id`, else the entry's index: stable across label edits, not across reorders, so give reorderable trails an `id`; `items` is live); the last entry is the current page. With a render function, `items` work as in the cdk (data-driven collection).

::example{id=breadcrumbs-items}

### Overflow

With `overflowMode="collapse"` the breadcrumbs that do not fit the container collapse into one item after the root (`showRoot`); `renderOverflow(items)` renders it, here a [Dropdown](dropdown.md) of the hidden pages. Each item is `{ key, textValue, href, props }` (plain-text children become `textValue`). At most `maxVisibleItems` breadcrumbs stay visible (default 4, `"auto"`: as many as fit); the current page never collapses. The server renders every breadcrumb (or `defaultVisibleItems`), the browser measures once the trail is visible and again on every resize.

::example{id=breadcrumbs-overflow}

## Customization

### Tailwind CSS

::example{id=breadcrumbs-custom-styles}

### Global CSS

To customize the Breadcrumbs component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .breadcrumbs {
    @apply gap-4 text-lg;
  }

  .breadcrumbs__link {
    @apply font-semibold;
  }

  .breadcrumbs__separator {
    @apply text-blue-500;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Breadcrumbs component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/breadcrumbs.css)):

#### Base Classes

- `.breadcrumbs` - Base breadcrumbs container
- `.breadcrumbs__item` - Individual breadcrumb item wrapper
- `.breadcrumbs__link` - Breadcrumb link element
- `.breadcrumbs__separator` - Separator icon between items

#### State Classes

- `.breadcrumbs__link[data-current="true"]` - Current page indicator (not a link)

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Current**: `[data-current="true"]` on link (indicates current page)
- **Hover**: Link elements support standard hover states
- **Disabled**: `isDisabled` prop disables all links

## API Reference

### Breadcrumbs

| Prop                  | Type                                                        | Default            | Description                                                                                |
| --------------------- | ----------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `separator`           | `Content`                                                   | chevron-right icon | Custom separator between breadcrumb items                                                  |
| `overflowMode`        | `"wrap" \| "collapse"`                                      | `"wrap"`           | Rivet addition: collapse the breadcrumbs that do not fit ([Overflow](#overflow))           |
| `showRoot`            | `boolean`                                                   | `false`            | Rivet addition: keep the first breadcrumb while it fits                                    |
| `maxVisibleItems`     | `number \| "auto"`                                          | `4`                | Rivet addition: at most this many visible, the overflow item counted                       |
| `defaultVisibleItems` | `number`                                                    | every item         | Rivet addition: visible breadcrumbs before the browser measures (server render)            |
| `renderOverflow`      | `(items: BreadcrumbsOverflowItem[]) => Content`             | -                  | Rivet addition: content of the overflow item (e.g. a Dropdown)                             |
| `isDisabled`          | `boolean`                                                   | `false`            | Whether all breadcrumb links are disabled                                                  |
| `class`               | `string`                                                    | -                  | Additional CSS classes                                                                     |
| `items`               | `Iterable<BreadcrumbsItemData \| T>`                        | -                  | Rivet addition: data items; without children one `Breadcrumbs.Item` each ([Items](#items)) |
| `children`            | `Content \| (item: T) => Content`                           | -                  | The breadcrumb items, or a render function of one item                                     |
| `render`              | `DOMRenderFunction<keyof JSX.IntrinsicElements, undefined>` | -                  | Overrides the default DOM element with a custom render function.                           |

### Breadcrumbs.Item

| Prop       | Type                                                                    | Default | Description                                                      |
| ---------- | ----------------------------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `href`     | `string`                                                                | -       | The URL to link to (omit for current page)                       |
| `class`    | `string`                                                                | -       | Additional CSS classes                                           |
| `children` | `Content \| RenderFunction`                                             | -       | Item content or render function                                  |
| `render`   | `DOMRenderFunction<keyof JSX.IntrinsicElements, BreadcrumbRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/breadcrumbs#BreadcrumbsRootProps"}

## Accessibility

Breadcrumbs uses React Aria Components' Breadcrumbs primitive, which provides:

- Proper ARIA attributes for navigation landmarks
- Current page indication via `aria-current="page"`
- Keyboard navigation support
- Screen reader announcements for navigation context

The last breadcrumb item (without `href`) automatically becomes the current page indicator.

## Related Components

- [Link](/components/link/): Styled anchor links.
- [Separator](/components/separator/): Visual divider between content.
- [Tabs](/components/tabs/): Organize content into tabbed views.
