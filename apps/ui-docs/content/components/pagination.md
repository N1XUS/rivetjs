---
title: Pagination
description: "Page navigation with customizable page links and navigation buttons."
template: reference
status: experimental
related: [components/button, components/breadcrumbs]
---

`Pagination` lays out page navigation: a `nav` landmark with an optional summary and a list of page links, previous / next buttons and ellipses. Links, `Previous` and `Next` are [cdk Buttons](site:cdk/components/button/) (press events, focus ring, disabled state); the other parts are plain elements with the Rivet UI classes.

Notes:

- `class`, not `className`. The demos keep the current page in a signal (`const page = signal(1)`); `isActive={p === page()}` / `isDisabled={page() === 1}` update the existing buttons in place.

## Usage

```tsx
import { Pagination } from "@rivetjs/ui/pagination";
```

::example{id=pagination-basic}

## Anatomy

```tsx
import { Pagination } from "@rivetjs/ui/pagination";

export default () => (
  <Pagination>
    <Pagination.Summary>Showing 1-10 of 100 results</Pagination.Summary>
    <Pagination.Content>
      <Pagination.Item>
        <Pagination.Previous>
          <Pagination.PreviousIcon />
          <span>Previous</span>
        </Pagination.Previous>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Link isActive>1</Pagination.Link>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Ellipsis />
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Link>10</Pagination.Link>
      </Pagination.Item>
      <Pagination.Item>
        <Pagination.Next>
          <span>Next</span>
          <Pagination.NextIcon />
        </Pagination.Next>
      </Pagination.Item>
    </Pagination.Content>
  </Pagination>
);
```

Additional exported parts: `Pagination.Root`.

## Examples

### Shorthand

Rivet addition: with `total` and no children, the root renders Previous, one link per page with an ellipsis per gap (`boundaries` pages at each end, `siblings` around the current page; the item count stays the same while paging) and Next, with the compound parts' markup. `page` is a number with `onPageChange`, a two-way Signal or an accessor; `defaultPage` starts it uncontrolled. `previousLabel` / `nextLabel` replace the "Previous" / "Next" text. `paginationRange(page, total, siblings, boundaries)` returns the same list for a custom layout. Explicit children win: next to children `total` is ignored, with a development warning.

A `page` outside 1…`total` is clamped (the last / first page is active; Previous / Next step from it). `paginationRange` floors fractional numbers, clamps `page` and returns `[]` for a non-finite `total`. The form is decided once, at render: adding or removing `total` / children later does not switch it.

::example{id=pagination-shorthand}

### Sizes

::example{id=pagination-sizes}

### Disabled

::example{id=pagination-disabled}

### Simple (Previous / Next)

::example{id=pagination-simple-prev-next}

### Controlled

::example{id=pagination-controlled}

### With Ellipsis

::example{id=pagination-with-ellipsis}

### With Summary

::example{id=pagination-with-summary}

### Custom Icons

You can replace the default chevron icons by passing custom children to `PreviousIcon` and `NextIcon`.

::example{id=pagination-custom-icons}

### Page Size Select

Rivet addition (not in the original demo set): the range in the summary is an [InlineSelect](/components/inline-select/) that picks the page size. `InlineSelect.Value` takes the range as children instead of the selected option's label; the options read "10 per page" and so on. A new size recomputes the page count and keeps the first visible item on screen (`page = floor(firstIndex / size) + 1`). Numbers go through `toLocaleString` with the `useLocale()` locale. The trigger is named by its value and the root's `aria-label` ("1–10 Items per page").

::example{id=pagination-page-size}

### Note

Pagination buttons use `onPress` instead of `onClick`. The `onPress` handler of the cdk Button (React Aria port) normalizes press behavior across pointer types and provides accessibility improvements out of the box.

## Customization

### Tailwind CSS

::example{id=pagination-custom-styles}

### Global CSS

To customize the Pagination component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .pagination {
    @apply gap-8;
  }

  .pagination__link {
    @apply rounded-md;
  }

  .pagination__summary {
    @apply text-xs font-semibold;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `pagination-summary`, `pagination-content`, `pagination-item`, `pagination-link`, `pagination-previous`, `pagination-previous-icon`, `pagination-next`, `pagination-next-icon`, `pagination-ellipsis`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Pagination component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/pagination.css)):

#### Base & Layout Classes

- `.pagination` - Root navigation container with flex layout
- `.pagination__summary` - Left-side info text container
- `.pagination__content` - Container for pagination items
- `.pagination__item` - Individual item wrapper
- `.pagination__link` - Page number button (ghost button style)
- `.pagination__link--nav` - Navigation button modifier (Previous/Next)
- `.pagination__ellipsis` - Ellipsis indicator

#### Size Classes

- `.pagination--sm` - Small size variant
- `.pagination--md` - Medium size variant (default)
- `.pagination--lg` - Large size variant

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Active page**: `[data-active="true"]` or `[aria-current="page"]`
- **Hover**: `:hover` or `[data-hovered="true"]`
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`
- **Disabled**: `:disabled` or `[aria-disabled="true"]`
- **Pressed**: `:active` or `[data-pressed="true"]`

## API Reference

See the [full module API](/api/rivetjs/ui/pagination/) for every named export and part prop type.

### Pagination

| Prop                          | Type                                       | Default                 | Description                                                                |
| ----------------------------- | ------------------------------------------ | ----------------------- | -------------------------------------------------------------------------- |
| `size`                        | `"sm" \| "md" \| "lg"`                     | `"md"`                  | Size of the pagination items                                               |
| `class`                       | `string`                                   | -                       | Additional CSS classes                                                     |
| `children`                    | `Content`                                  | -                       | Pagination parts (Summary, Content)                                        |
| `total`                       | `number`                                   | -                       | Rivet shorthand: number of pages (no children: the root renders the links) |
| `page`                        | `number \| Signal<number> \| () => number` | -                       | Rivet shorthand: current page, 1-based (Signal two-way)                    |
| `defaultPage`                 | `number`                                   | `1`                     | Rivet shorthand: uncontrolled start page                                   |
| `onPageChange`                | `(page: number) => void`                   | -                       | Rivet shorthand: called with the new page                                  |
| `siblings`                    | `number`                                   | `1`                     | Rivet shorthand: pages on each side of the current one                     |
| `boundaries`                  | `number`                                   | `1`                     | Rivet shorthand: pages always shown at each end                            |
| `previousLabel` / `nextLabel` | `Content`                                  | `"Previous"` / `"Next"` | Rivet shorthand: text next to the icons                                    |

### Pagination.Summary

| Prop       | Type      | Default | Description                                   |
| ---------- | --------- | ------- | --------------------------------------------- |
| `class`    | `string`  | -       | Additional CSS classes                        |
| `children` | `Content` | -       | Summary content (e.g., "Showing 1-10 of 120") |

### Pagination.Content

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Pagination items       |

### Pagination.Item

| Prop       | Type      | Default | Description                                      |
| ---------- | --------- | ------- | ------------------------------------------------ |
| `class`    | `string`  | -       | Additional CSS classes                           |
| `children` | `Content` | -       | Item content (Link, Previous, Next, or Ellipsis) |

### Pagination.Link

| Prop         | Type                      | Default | Description                      |
| ------------ | ------------------------- | ------- | -------------------------------- |
| `isActive`   | `boolean`                 | `false` | Whether this is the current page |
| `isDisabled` | `boolean`                 | `false` | Whether the link is disabled     |
| `onPress`    | `(e: PressEvent) => void` | -       | Press handler (cdk Button)       |
| `class`      | `string`                  | -       | Additional CSS classes           |
| `children`   | `Content`                 | -       | Page number content              |

### Pagination.Previous / Pagination.Next

| Prop         | Type                      | Default | Description                                         |
| ------------ | ------------------------- | ------- | --------------------------------------------------- |
| `isDisabled` | `boolean`                 | `false` | Whether the button is disabled                      |
| `onPress`    | `(e: PressEvent) => void` | -       | Press handler (cdk Button)                          |
| `class`      | `string`                  | -       | Additional CSS classes                              |
| `children`   | `Content`                 | -       | Button content (compose with PreviousIcon/NextIcon) |

### Pagination.PreviousIcon / Pagination.NextIcon

| Prop       | Type      | Default        | Description                                |
| ---------- | --------- | -------------- | ------------------------------------------ |
| `class`    | `string`  | -              | Additional CSS classes                     |
| `children` | `Content` | lucide chevron | Custom icon to replace the default chevron |

### Pagination.Ellipsis

| Prop    | Type     | Default | Description            |
| ------- | -------- | ------- | ---------------------- |
| `class` | `string` | -       | Additional CSS classes |

::api{symbol="@rivetjs/ui/pagination#PaginationRoot"}

## Accessibility

The Pagination component is built on the [cdk Button](site:cdk/components/button/) primitive (React Aria Button port) for all interactive elements, providing:

- Semantic `<nav>` element with `aria-label="pagination"` and `role="navigation"`
- Active page indicated via `aria-current="page"` on the current link
- Keyboard navigation via Tab key through all interactive elements
- Press events handled across mouse, touch, and keyboard interactions via the cdk Button
- Focus ring on keyboard navigation via `:focus-visible`
- Ellipsis marked with `aria-hidden="true"` to avoid screen reader confusion
- Disabled states properly communicated to assistive technology via `isDisabled`

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Link](/components/link/): Styled anchor links.
