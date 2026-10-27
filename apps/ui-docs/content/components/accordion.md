---
title: Accordion
description: "A collapsible content panel for organizing information in a compact space."
template: reference
status: experimental
related: [components/disclosure-group, components/disclosure]
---

`Accordion` stacks collapsible items: one expanded at a time by default, several with `allowsMultipleExpanded`. The root is the [cdk DisclosureGroup](site:cdk/components/accordion/) and each `Accordion.Item` a cdk `Disclosure` (its `id` is the key in `expandedKeys`); `Accordion.Panel` is the cdk `DisclosurePanel`, which animates its `--disclosure-panel-height` variable.

Notes:

- `class`, not `className`. `expandedKeys` takes a two-way signal of a `Set`, so the demos drop `useState` + `onExpandedChange`; a plain `Set` is controlled and `onExpandedChange` still fires.
- `Accordion.Indicator` renders the lucide `ChevronDown` icon. Custom indicator children are not cloned: they render inside a `span` that carries the indicator class, `data-slot` and `data-expanded`.
- `render` functions on the parts receive accessor-valued attributes; type them `(props: Record<string, any>)` when spreading onto another tag.

## Usage

```tsx
import { Accordion } from "@rivetjs/ui/accordion";
```

::example{id=accordion-basic}

## Anatomy

```tsx
import { Accordion } from "@rivetjs/ui/accordion";

export default () => (
  <Accordion>
    <Accordion.Item>
      <Accordion.Heading>
        <Accordion.Trigger>
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body />
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion>
);
```

Additional exported parts: `Accordion.Root`.

## Examples

### Surface

::example{id=accordion-surface}

### Without Separator

::example{id=accordion-without-separator}

### Multiple Expanded

::example{id=accordion-multiple}

### Disabled State

::example{id=accordion-disabled}

### Controlled

::example{id=accordion-controlled}

### Custom Indicator

::example{id=accordion-custom-indicator}

### Render Function

::example{id=accordion-render-function}

### FAQ Layout

::example{id=accordion-faq}

## Customization

### Tailwind CSS

::example{id=accordion-custom-styles}

### Global CSS

To customize the Accordion component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .accordion {
    @apply rounded-xl bg-gray-50;
  }

  .accordion__trigger {
    @apply font-semibold text-lg;
  }

  .accordion--outline {
    @apply shadow-lg border-2;
  }
}
```

## Styling Reference

The component’s parts emit these additional `data-slot` values: `accordion-item`, `accordion-indicator`, `accordion-heading`, `accordion-trigger`, `accordion-body`, `accordion-panel`.

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Accordion component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/accordion.css)):

#### Base Classes

- `.accordion` - Base accordion container
- `.accordion__body` - Content body container
- `.accordion__heading` - Heading wrapper
- `.accordion__indicator` - Expand/collapse indicator icon
- `.accordion__item` - Individual accordion item
- `.accordion__panel` - Collapsible panel container
- `.accordion__trigger` - Clickable trigger button

#### Variant Classes

- `.accordion--surface` - Built-in surface variant. `.accordion--outline` in the customization example is a custom class, not a shipped variant.

#### State Classes

- `.accordion__trigger[aria-expanded="true"]` - Expanded state
- `.accordion__panel[aria-hidden="false"]` - Panel visible state

### Zero-JS native path

Where the build proves an accordion call site closed (declared data props only, no handlers, no controlled or default expansion, no render props, no live values, no context-reading components inside, no state selectors in the calling module), it renders native markup and ships no JavaScript, before or after an interaction: items are `<details>` (single expansion: one shared `name`), the heading sits in a `<summary class="accordion__summary">`, the trigger is a `span`, expanded = `details[open]`; `aria-expanded` / `data-expanded` are not set there, keyboard = native (Tab between summaries, Enter / Space toggle). Classes, slots and `data-disabled` stay the same; style state with the selectors above that include the native form (`:checked`, `[open]`, `:focus-visible`), not with a state attribute alone. Opening and closing animate there too, in CSS: the `<details>` content slot (`details.accordion__item::details-content`) eases a one-row grid `0fr` → `1fr` plus opacity over `--duration-base` (the interactive path animates `.accordion__panel` height); reduced motion snaps. Browsers without `::details-content` open and close instantly; Safari 26 animates opening only. Any other call site keeps the interactive path. See the framework guide "Native automata".

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Hover**: `:hover` or `[data-hovered="true"]` on trigger
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
- **Disabled**: `:disabled` or `[aria-disabled="true"]` on trigger
- **Expanded**: `[aria-expanded="true"]` on trigger

## API Reference

See the [full module API](/api/rivetjs/ui/accordion/) for every named export and part prop type.

### Accordion

| Prop                     | Type                                                         | Default     | Description                                                      |
| ------------------------ | ------------------------------------------------------------ | ----------- | ---------------------------------------------------------------- |
| `allowsMultipleExpanded` | `boolean \| Signal<boolean> \| (() => boolean \| undefined)` | `false`     | Whether multiple items can be expanded at once                   |
| `defaultExpandedKeys`    | `Iterable<Key>`                                              | -           | The initial expanded keys                                        |
| `expandedKeys`           | `Iterable<Key> \| Signal<Set<Key>>`                          | -           | The controlled expanded keys (a signal is two-way)               |
| `onExpandedChange`       | `(keys: Set<Key>) => void`                                   | -           | Handler called when expanded keys change                         |
| `isDisabled`             | `boolean`                                                    | `false`     | Whether the entire accordion is disabled                         |
| `variant`                | `"default" \| "surface"`                                     | `"default"` | The visual variant of the accordion                              |
| `hideSeparator`          | `boolean`                                                    | `false`     | Hide separator lines between accordion items                     |
| `class`                  | `string`                                                     | -           | Additional CSS classes                                           |
| `children`               | `Content`                                                    | -           | The accordion items                                              |
| `render`                 | `DOMRenderFunction<"div", DisclosureGroupRenderProps>`       | -           | Overrides the default DOM element with a custom render function. |

### Accordion.Item

| Prop               | Type                                              | Default | Description                                                      |
| ------------------ | ------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `id`               | `Key`                                             | -       | Unique identifier for the item                                   |
| `isDisabled`       | `boolean`                                         | `false` | Whether this item is disabled                                    |
| `defaultExpanded`  | `boolean`                                         | `false` | Whether item is initially expanded                               |
| `isExpanded`       | `boolean \| Signal<boolean>`                      | -       | Controlled expanded state                                        |
| `onExpandedChange` | `(isExpanded: boolean) => void`                   | -       | Handler for expanded state changes                               |
| `class`            | `string`                                          | -       | Additional CSS classes                                           |
| `children`         | `Content`                                         | -       | The item content                                                 |
| `render`           | `DOMRenderFunction<"div", DisclosureRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Accordion.Trigger

| Prop         | Type                                             | Default | Description                                                      |
| ------------ | ------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `class`      | `string`                                         | -       | Additional CSS classes                                           |
| `children`   | `Content \| RenderFunction`                      | -       | Trigger content or render function                               |
| `onPress`    | `() => void`                                     | -       | Additional press handler                                         |
| `isDisabled` | `boolean`                                        | -       | Whether trigger is disabled                                      |
| `render`     | `DOMRenderFunction<"button", ButtonRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Accordion.Panel

| Prop       | Type                                                   | Default | Description                                                      |
| ---------- | ------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `class`    | `string`                                               | -       | Additional CSS classes                                           |
| `children` | `Content`                                              | -       | Panel content                                                    |
| `render`   | `DOMRenderFunction<"div", DisclosurePanelRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Accordion.Indicator

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Custom indicator icon  |

### Accordion.Body

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `class`    | `string`  | -       | Additional CSS classes |
| `children` | `Content` | -       | Body content           |

::api{symbol="@rivetjs/ui/accordion#AccordionRootProps"}

## Accessibility

Each trigger is a `button` inside the heading with `aria-expanded` and `aria-controls`; the panel has `role="group"` and is labelled by its trigger. Enter and Space toggle the item. A collapsed panel is `hidden="until-found"`, so find-in-page expands it on a match.

## Related Components

- [DisclosureGroup](/components/disclosure-group/): Group of collapsible panels.
- [Disclosure](/components/disclosure/): Single collapsible content section.
