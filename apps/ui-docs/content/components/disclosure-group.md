---
title: DisclosureGroup
description: "Container that manages multiple Disclosure items with coordinated expanded states."
template: reference
status: experimental
related: [components/accordion, components/disclosure, components/button]
---

`DisclosureGroup` coordinates the expanded state of several [Disclosure](/components/disclosure/) items: one at a time by default, several with `allowsMultipleExpanded`. The root is the [cdk DisclosureGroup](site:cdk/components/disclosure/) (each `Disclosure`'s `id` is its key in `expandedKeys`). `useDisclosureGroupNavigation` adds previous / next controls.

Notes:

- `class`, not `className`. `expandedKeys` takes a two-way signal of a `Set`, so the demos drop `useState` + `onExpandedChange`; a plain `Set` is controlled and `onExpandedChange` still fires.
- `useDisclosureGroupNavigation` returns accessors for `currentIndex`, `isPrevDisabled` and `isNextDisabled` (pass them as `isDisabled={isPrevDisabled}`); `expandedKeys` may be a signal, and `onPrevious` / `onNext` read the latest keys when pressed.
- The demos' brand icons come from lucide (`QrCode`, `Apple`; the Expo logo → `Smartphone`).

## Usage

```tsx
import { DisclosureGroup } from "@rivetjs/ui/disclosure-group";
```

::example{id=disclosure-group-basic}

## Anatomy

```tsx
import { Disclosure } from "@rivetjs/ui/disclosure";
import { DisclosureGroup } from "@rivetjs/ui/disclosure-group";

export default () => (
  <DisclosureGroup>
    <Disclosure id="item1">
      <Disclosure.Heading>
        <Disclosure.Trigger>
          <Disclosure.Indicator />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content />
    </Disclosure>
  </DisclosureGroup>
);
```

Additional exported parts: `DisclosureGroup.Root`.

## Examples

### Controlled

You can control which disclosures are expanded with external navigation controls using the `expandedKeys` and `onExpandedChange` props.

::example{id=disclosure-group-controlled}

## Customization

### Tailwind CSS

::example{id=disclosure-group-custom-styles}

### Global CSS

To customize the DisclosureGroup component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .disclosure-group {
    @apply w-full;

    /* Performance optimization */
    contain: layout style;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The DisclosureGroup component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/disclosure-group.css)):

#### Base Classes

- `.disclosure-group` - Base container styles with layout containment

### Interactive States

The component supports both CSS pseudo-classes and data attributes for flexibility:

- **Disabled**: `:disabled` or `[aria-disabled="true"]` on entire group
- **Expanded Management**: Automatically manages `[data-expanded]` states on child Disclosure items

## API Reference

See the [full module API](/api/rivetjs/ui/disclosure-group/) for every named export and part prop type.

### DisclosureGroup

| Prop                     | Type                                                         | Default | Description                                                    |
| ------------------------ | ------------------------------------------------------------ | ------- | -------------------------------------------------------------- |
| `expandedKeys`           | `Set<Key> \| Signal<Set<Key>>`                               | -       | The currently expanded items (controlled; a signal is two-way) |
| `defaultExpandedKeys`    | `Iterable<Key>`                                              | -       | The initially expanded items (uncontrolled)                    |
| `onExpandedChange`       | `(keys: Set<Key>) => void`                                   | -       | Handler called when expanded items change                      |
| `allowsMultipleExpanded` | `boolean \| Signal<boolean> \| (() => boolean \| undefined)` | `false` | Whether multiple items can be expanded simultaneously          |
| `isDisabled`             | `boolean`                                                    | `false` | Whether all disclosures in the group are disabled              |
| `children`               | `Content \| RenderFunction`                                  | -       | Disclosure items to render                                     |
| `class`                  | `string`                                                     | -       | Additional CSS classes                                         |

### Render Props

When using the render prop pattern, these values are provided:

| Prop         | Type                   | Description                                                   |
| ------------ | ---------------------- | ------------------------------------------------------------- |
| `state`      | `DisclosureGroupState` | Group state (cdk); `state.expandedKeys()` = the expanded keys |
| `isDisabled` | `boolean`              | Whether the group is disabled                                 |

::api{symbol="@rivetjs/ui/disclosure-group#DisclosureGroupRootProps"}

## Accessibility

Each Disclosure keeps its own trigger `button` (`aria-expanded`, `aria-controls`) and labelled panel; the group adds no role. `isDisabled` on the group disables every trigger.

## Related Components

- [Accordion](/components/accordion/): Collapsible content panels.
- [Disclosure](/components/disclosure/): Single collapsible content section.
- [Button](/components/button/): Allows a user to perform an action.
