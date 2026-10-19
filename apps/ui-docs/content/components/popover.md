---
title: Popover
description: "Displays rich content in a portal triggered by a button or any custom element."
template: reference
status: experimental
related: [components/button, components/tooltip, components/avatar]
---

`Popover` shows rich content next to a trigger. The root is the [cdk DialogTrigger](site:cdk/components/dialog/): its first child (a [Button](button.md) or `Popover.Trigger`) opens `Popover.Content`, the [cdk Popover](site:cdk/components/popover/) on the shared div overlay layer with a `Popover.Dialog` inside.

Notes:

- `class`, not `className`. `isOpen` takes a signal (two-way: dismissing writes `false` back).
- The popover renders in Rivet's div overlay layer (no native `popover` / top layer); an open popover is in the server HTML.
- `Popover.Arrow`'s default tip is a CSS-shaped `span` filled with `var(--overlay)`. A custom arrow child is not cloned: give it `data-slot="popover-overlay-arrow"` so the placement rotation applies.
- `Popover.Trigger` is a `div role="button"` made pressable by the cdk `Pressable` (render-function child internally).
- `Popover.Content` renders the `Popover.Dialog` itself, and `title` renders a `Popover.Heading` first. Children may be a function of the dialog render props (`({ close }) => …`). Write `dialog={false}` to put your own `Popover.Dialog` in, for example to style or label it. See [Content](#content).

Accessibility: The content is a `dialog` labelled by `Popover.Heading`; focus moves into it on open and returns to the trigger on close. Escape and an outside press dismiss it. The trigger gets `aria-expanded` / `aria-controls`.

## Usage

```tsx
import { Popover } from "@rivetjs/ui/popover";
```

::example{id=popover-basic}

## Anatomy

```tsx
import { Popover } from "@rivetjs/ui/popover";

export default () => (
  <Popover>
    <Popover.Trigger />
    <Popover.Content title="Title">
      <Popover.Arrow />
      {/* content goes here */}
    </Popover.Content>
  </Popover>
);
```

## Examples

### With Arrow

::example{id=popover-with-arrow}

### Interactive Content

::example{id=popover-interactive}

### Placement

::example{id=popover-placement}

### Render Function

::example{id=popover-render-function}

### Content

`Popover.Content` folds the dialog: the explicit parts and the shorthand render the same markup.

```tsx
// explicit parts
<Popover.Content class="max-w-64" dialog={false}>
  <Popover.Dialog>
    <Popover.Heading>Title</Popover.Heading>
    <p>Body</p>
  </Popover.Dialog>
</Popover.Content>

// shorthand
<Popover.Content class="max-w-64" title="Title">
  <p>Body</p>
</Popover.Content>

// the dialog render props
<Popover.Content title="Delete file?">
  {({ close }) => <Button onPress={close}>Cancel</Button>}
</Popover.Content>
```

A `Popover.Dialog` inside a Content without `dialog={false}` renders only its children (the Content already made the dialog), so its own props do not apply.

## Customization

### Tailwind CSS

::example{id=popover-custom-styles}

### Global CSS

To customize the Popover component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .popover {
    @apply rounded-xl shadow-2xl;
  }

  .popover__dialog {
    @apply p-4;
  }

  .popover__heading {
    @apply text-lg font-bold;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Popover component uses these CSS classes ([View source styles](https://github.com/N1XUS/rivetjs/blob/main/libs/ui/styles/components/popover.css)):

#### Base Classes

- `.popover` - Base popover container styles
- `.popover__dialog` - Dialog content wrapper
- `.popover__heading` - Heading text styles
- `.popover__trigger` - Trigger element styles

### Interactive States

The component supports animation states:

- **Entering**: `[data-entering]` - Applied during popover appearance
- **Exiting**: `[data-exiting]` - Applied during popover disappearance
- **Placement**: `[data-placement="*"]` - Applied based on popover position
- **Focus**: `:focus-visible` or `[data-focus-visible="true"]`

## API Reference

### Popover

| Prop           | Type                        | Default | Description                                       |
| -------------- | --------------------------- | ------- | ------------------------------------------------- |
| `children`     | `Content`                   | -       | Trigger and content elements                      |
| `isOpen`       | `Signal<boolean>`           | -       | Controls popover visibility (controlled, two-way) |
| `defaultOpen`  | `boolean`                   | `false` | Initial open state (uncontrolled)                 |
| `onOpenChange` | `(isOpen: boolean) => void` | -       | Called when open state changes                    |

### Popover.Content

| Prop         | Type                                                    | Default    | Description                                                             |
| ------------ | ------------------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| `children`   | `Content \| ((opts: { close }) => Content)`             | -          | Content to display in the popover (a function: the dialog render props) |
| `title`      | `Content`                                               | -          | Rivet: a `Popover.Heading` before the content (labels the dialog)       |
| `dialog`     | `boolean`                                               | `true`     | Rivet: wrap the content in a `Popover.Dialog`; `false` = write your own |
| `placement`  | `"top" \| "bottom" \| "left" \| "right"` (and variants) | `"bottom"` | Placement of the popover                                                |
| `offset`     | `number`                                                | `8`        | Distance from the trigger element                                       |
| `shouldFlip` | `boolean`                                               | `true`     | Whether popover can change orientation to fit                           |
| `class`      | `string`                                                | -          | Additional CSS classes                                                  |
| `render`     | `DOMRenderFunction<"div", PopoverRenderProps>`          | -          | Overrides the default DOM element with a custom render function.        |

### Popover.Dialog

| Prop       | Type      | Default | Description            |
| ---------- | --------- | ------- | ---------------------- |
| `children` | `Content` | -       | Dialog content         |
| `class`    | `string`  | -       | Additional CSS classes |

Inside a `Popover.Content` that folds its dialog (no `dialog={false}`), `Popover.Dialog` renders only its children.

### Popover.Trigger

| Prop       | Type      | Default | Description                       |
| ---------- | --------- | ------- | --------------------------------- |
| `children` | `Content` | -       | Element that triggers the popover |
| `class`    | `string`  | -       | Additional CSS classes            |

### Popover.Arrow

| Prop       | Type                                                | Default | Description                                                      |
| ---------- | --------------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `children` | `Content`                                           | -       | Custom arrow element                                             |
| `class`    | `string`                                            | -       | Additional CSS classes                                           |
| `render`   | `DOMRenderFunction<"div", OverlayArrowRenderProps>` | -       | Overrides the default DOM element with a custom render function. |

::api{symbol="@rivetjs/ui/popover#PopoverContentProps"}

## Related Components

- [Button](/components/button/): Allows a user to perform an action.
- [Tooltip](/components/tooltip/): Contextual information on hover or focus.
- [Select](/components/select/): Dropdown select control.
