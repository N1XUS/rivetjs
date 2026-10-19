---
title: Disclosure
description: "A disclosure is a collapsible section with a header containing a heading and a trigger button, and a panel that wraps the content."
template: reference
status: experimental
related: [components/accordion, components/disclosure-group, components/button]
---

`Disclosure` is a collapsible section: a heading with a trigger button and a panel that wraps the content. The root is the [cdk Disclosure](site:cdk/components/disclosure/) (expanded state, `aria-expanded` / `aria-controls`, `hidden="until-found"` so find-in-page opens a collapsed panel); `Disclosure.Content` is the cdk `DisclosurePanel`, which animates its `--disclosure-panel-height` variable.

Notes:

- `class`, not `className`. `isExpanded` takes a signal (two-way), so the demos drop `useState` + `onExpandedChange`; a plain value is controlled and `onExpandedChange` still fires.
- `Disclosure.Indicator` renders the lucide `ChevronDown` icon. Custom indicator children are not cloned: they render inside a `span` that carries the indicator class, `data-slot` and `data-expanded`.
- The demos' brand icons come from lucide (`QrCode`, `Apple`, `ShoppingBag`).

Accessibility: The trigger is a `button` with `aria-expanded` and `aria-controls`; the panel has `role="group"` and is labelled by the trigger. Enter and Space toggle the panel. A collapsed panel is `hidden="until-found"`, so the browser's find-in-page expands it on a match.

## Usage

```tsx
import { Disclosure } from "@rivetjs/ui/disclosure";
```

::example{id=disclosure-basic}

## Anatomy

```tsx
import { Disclosure } from "@rivetjs/ui/disclosure";

export default () => (
  <Disclosure>
    <Disclosure.Heading>
      <Disclosure.Trigger>
        <Disclosure.Indicator />
      </Disclosure.Trigger>
    </Disclosure.Heading>
    <Disclosure.Content />
  </Disclosure>
);
```

## Examples

### Render Function

::example{id=disclosure-render-function}

## Customization

### Tailwind CSS

::example{id=disclosure-custom-styles}

### Global CSS

To customize the Disclosure component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .disclosure {
    @apply relative;
  }

  .disclosure__trigger {
    @apply cursor-pointer;
  }

  .disclosure__indicator {
    @apply transition-transform duration-300;
  }

  .disclosure__content {
    @apply overflow-hidden transition-all;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Disclosure component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/disclosure.css)):

#### Base Classes

- `.disclosure` - Base container styles
- `.disclosure__heading` - Heading wrapper
- `.disclosure__trigger` - Trigger button styles
- `.disclosure__indicator` - Chevron indicator styles
- `.disclosure__content` - Content container with animations

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Expanded**: `[data-expanded="true"]` on indicator for rotation
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]` on trigger
- **Disabled**: `:disabled` or `[aria-disabled="true"]` on trigger
- **Hidden**: `[aria-hidden="false"]` on content for visibility

## API Reference

### Disclosure

| Prop               | Type                                              | Default | Description                                                      |
| ------------------ | ------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `isExpanded`       | `boolean \| Signal<boolean>`                      | `false` | Controls the expanded state (a signal is two-way)                |
| `onExpandedChange` | `(isExpanded: boolean) => void`                   | -       | Callback when expanded state changes                             |
| `isDisabled`       | `boolean`                                         | `false` | Whether the disclosure is disabled                               |
| `children`         | `Content \| RenderFunction`                       | -       | Content to render                                                |
| `class`            | `string`                                          | -       | Additional CSS classes                                           |
| `render`           | `DOMRenderFunction<"div", DisclosureRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### DisclosureTrigger

| Prop       | Type                        | Default | Description            |
| ---------- | --------------------------- | ------- | ---------------------- |
| `children` | `Content \| RenderFunction` | -       | Trigger content        |
| `class`    | `string`                    | -       | Additional CSS classes |

### DisclosureContent

| Prop       | Type                                                   | Default | Description                                                      |
| ---------- | ------------------------------------------------------ | ------- | ---------------------------------------------------------------- |
| `children` | `Content`                                              | -       | Content to show/hide                                             |
| `class`    | `string`                                               | -       | Additional CSS classes                                           |
| `render`   | `DOMRenderFunction<"div", DisclosurePanelRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

### Render Props

When using the render prop pattern, these values are provided (accessors):

| Prop         | Type            | Description                    |
| ------------ | --------------- | ------------------------------ |
| `isExpanded` | `() => boolean` | Current expanded state         |
| `isDisabled` | `() => boolean` | Whether disclosure is disabled |

::api{symbol="@rivetjs/ui/disclosure#DisclosureRootProps"}

## Related Components

- [Accordion](/components/accordion/): Collapsible content panels.
- [DisclosureGroup](/components/disclosure-group/): Group of collapsible panels.
- [Button](/components/button/): Allows a user to perform an action.
