---
title: Kbd
description: "Display keyboard shortcuts and key combinations."
template: reference
status: experimental
related: []
---

`Kbd` shows a key or a shortcut.

Notes:

- `class`, not `className`.
- The key symbols are text labels, not icons.

Accessibility: The `abbr` carries the key's name in `title`. For an exact spoken label, set `aria-label` on the root ("Command K").

## Usage

```tsx
import { Kbd } from "@rivetjs/ui/kbd";
```

::example{id=kbd-basic}

## Anatomy

```tsx
import { Kbd } from "@rivetjs/ui/kbd";

export default () => (
  <Kbd>
    <Kbd.Abbr title="Command">⌘</Kbd.Abbr>
    <Kbd.Content>K</Kbd.Content>
  </Kbd>
);
```

## Examples

### Variants

::example{id=kbd-variants}

### Navigation Keys

::example{id=kbd-navigation-keys}

### Inline Usage

::example{id=kbd-inline-usage}

### Instructional Text

::example{id=kbd-instructional-text}

### Special Keys

::example{id=kbd-special-keys}

## Customization

### Tailwind CSS

::example{id=kbd-custom-styles}

### Global CSS

To customize the Kbd component classes, you can use the `@layer components` directive.
[Learn more](https://tailwindcss.com/docs/adding-custom-styles#adding-component-classes).

```css
@layer components {
  .kbd {
    @apply bg-gray-100 dark:bg-gray-800 border-gray-300;
  }

  .kbd__abbr {
    @apply font-bold;
  }

  .kbd__content {
    @apply text-sm;
  }
}
```

## Styling Reference

Rivet UI follows the [BEM](https://getbem.com/) methodology to ensure component variants and states are reusable and easy to customize.

### CSS Classes

The Kbd component uses these CSS classes ([View source styles](https://github.com/rivetjs/rivet/blob/main/libs/ui/styles/components/kbd.css)):

#### Base Classes

- `.kbd` - Base keyboard key styles with background, border, and spacing
- `.kbd__abbr` - Abbreviation element for modifier keys
- `.kbd__content` - Content wrapper for key text

## API Reference

### Kbd

| Prop       | Type       | Default  | Description        |
| ---------- | ---------- | -------- | ------------------ |
| `children` | `Content`  | -        | Content of the key |
| `variant`  | `"default" | "light"` | `default`          | Variant of the keyboard key |
| `class`    | `string`   | -        | Custom CSS classes |

### Kbd.Abbr

| Prop       | Type      | Default | Description                                               |
| ---------- | --------- | ------- | --------------------------------------------------------- |
| `title`    | `string`  | -       | Title attribute for accessibility (e.g., "Command" for ⌘) |
| `children` | `Content` | -       | The symbol or text to display (e.g., ⌘, ⌥, ⇧)             |
| `class`    | `string`  | -       | Custom CSS classes                                        |

### Kbd.Key

| Prop       | Type      | Default | Description             |
| ---------- | --------- | ------- | ----------------------- |
| `children` | `Content` | -       | Text content of the key |
| `class`    | `string`  | -       | Custom CSS classes      |

### Kbd.Content Type

Available key values for the `keyValue` prop:

| Modifier Keys | Special Keys | Navigation Keys | Function Keys |
| ------------- | ------------ | --------------- | ------------- |
| `command`     | `enter`      | `up`            | `fn`          |
| `shift`       | `delete`     | `down`          |               |
| `ctrl`        | `escape`     | `left`          |               |
| `option`      | `tab`        | `right`         |               |
| `alt`         | `space`      | `pageup`        |               |
| `win`         | `capslock`   | `pagedown`      |               |
|               | `help`       | `home`          |               |
|               |              | `end`           |               |

::api{symbol="@rivetjs/ui/kbd#KbdRootProps"}

## Related Components
